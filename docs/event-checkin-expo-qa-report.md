# Event Check-In App - Independent QA Audit Report

**Date:** February 15, 2026  
**Event:** Black and Blue Gala, Volusia County  
**Reviewer:** Independent QA Agent (Subagent)  
**Backend:** Supabase (efcgzxjwystresjbcezc.supabase.co)

---

## Executive Summary

This report provides an independent, comprehensive review of the Event Check-In Expo/React Native application prior to production deployment at the Black and Blue Gala. The assessment covered 10 critical focus areas including authentication, real-time sync, offline functionality, security, performance, and deployment readiness.

**Overall Confidence Score: 72/100**

The application demonstrates solid architecture with good offline-first design and real-time capabilities. However, **several critical issues must be addressed before the event** to prevent potential user lockouts, data loss, and concurrent check-in conflicts.

---

## Critical Issues (MUST FIX BEFORE EVENT)

### 🔴 CRITICAL-1: Race Condition in Authentication Session Restore

**Location:** `contexts/SupabaseContext.tsx`, lines 39-64

**Issue:** The session initialization logic has a race condition where both AsyncStorage restoration AND Supabase's `getSession()` are attempted simultaneously. This creates a potential for:
- Duplicate session setting
- Stale sessions being restored over fresh ones
- User lockouts when stored session is invalid but new session would be valid

**Code:**
```typescript
const initialiseAuth = async () => {
  try {
    // First, try to restore session from AsyncStorage
    const storedSession = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    if (storedSession && mounted) {
      const parsedSession = JSON.parse(storedSession) as Session;
      // ... validates and sets session
    }
  } catch (error) { ... }

  // Always check current session from Supabase
  const { data } = await supabase.auth.getSession();
  if (!mounted) return;
  setSession(data.session ?? null);  // ⚠️ May overwrite restored session!
  setLoading(false);
};
```

**Impact:** Users who successfully signed in may be logged out on app restart if Supabase session check completes after AsyncStorage restore but returns null.

**Recommendation:**
```typescript
const initialiseAuth = async () => {
  try {
    // Check Supabase first (source of truth)
    const { data } = await supabase.auth.getSession();
    
    if (data.session) {
      // Supabase has valid session - use it and persist
      if (mounted) {
        setSession(data.session);
        await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data.session));
      }
    } else {
      // No Supabase session - try cache, then validate
      const storedSession = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      if (storedSession && mounted) {
        const parsedSession = JSON.parse(storedSession);
        // Validate cached session with Supabase
        const { data: validatedData, error } = await supabase.auth.setSession({
          access_token: parsedSession.access_token,
          refresh_token: parsedSession.refresh_token,
        });
        
        if (!error && validatedData.session) {
          setSession(validatedData.session);
        } else {
          await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
          setSession(null);
        }
      } else {
        setSession(null);
      }
    }
  } catch (error) {
    console.error('Auth initialization failed:', error);
    setSession(null);
  } finally {
    setLoading(false);
  }
};
```

---

### 🔴 CRITICAL-2: Concurrent Check-In Race Condition

**Location:** `services/attendees.ts` + Supabase RPC `toggle_checkin`

**Issue:** When two devices check in the same attendee simultaneously:
1. Both call `toggle_checkin` RPC
2. Both succeed (no locking mechanism)
3. Last write wins, but **both local states show checked-in**
4. **No conflict notification to users**
5. If one device is offline and queues the operation, sync may reverse the check-in

**Evidence:**
```typescript
// toggle_checkin RPC in SQL
update public.attendees
set checked_in = p_checked,
    checked_in_at = case when p_checked then now() else null end,
    checked_in_by = case when p_checked then auth.uid() else null end,
    updated_at = now()
where id = p_attendee_id
  and event_id in (select event_id from public.my_events);
```

No optimistic locking (version check) or conflict detection.

**Impact:** At a busy event with multiple checkers:
- Same person could be checked in twice
- Stats become unreliable
- Undo from one device affects another checker's work without warning

**Recommendation:**
Add version-based optimistic locking:

```sql
-- Add version column to attendees
alter table public.attendees add column version integer not null default 0;

-- Update RPC with version check
create or replace function public.toggle_checkin(
  p_attendee_id uuid, 
  p_checked boolean,
  p_expected_version integer
)
returns jsonb
language plpgsql security definer
as $$
declare
  v_updated integer;
  v_current_version integer;
begin
  -- Get current version
  select version into v_current_version
  from public.attendees
  where id = p_attendee_id;

  -- Check version match
  if v_current_version != p_expected_version then
    return jsonb_build_object(
      'success', false,
      'error', 'conflict',
      'current_version', v_current_version
    );
  end if;

  -- Perform update with version increment
  update public.attendees
  set checked_in = p_checked,
      checked_in_at = case when p_checked then now() else null end,
      checked_in_by = case when p_checked then auth.uid() else null end,
      version = version + 1,
      updated_at = now()
  where id = p_attendee_id
    and event_id in (select event_id from public.my_events);

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  return jsonb_build_object('success', true, 'version', v_current_version + 1);
end;
$$;
```

Client-side: Show conflict alert and refresh attendee list when version mismatch detected.

---

### 🔴 CRITICAL-3: Offline Queue Data Loss on Cache Update

**Location:** `services/offlineQueue.ts` + `services/attendees.ts`

**Issue:** The offline queue system has a critical flaw in the cache update flow:

1. User is offline, checks in attendee → queued + cache updated optimistically
2. User goes online → sync begins
3. **During sync**, `fetchAttendees` is called (line 73-74 in index.tsx)
4. `fetchAttendees` **overwrites cache** with server data
5. Pending queue operations reference attendee IDs that may not reflect optimistic state
6. When `applyPendingCheckIns` runs, it may apply stale states

**Code Flow:**
```typescript
// syncManager.ts - line 106-108
if (synced > 0) {
  emitRefreshAttendees({ silent: true });  // ⚠️ Triggers fetchAttendees
}

// attendees.ts - line 177-180
const attendees = (data ?? [])
  .map((record) => mapRecordToAttendee(record as AttendeeRecord))
  .filter((attendee): attendee is Attendee => attendee !== null);

// Save to cache for offline use
if (useCache) {
  await saveAttendeesToCache(eventId, attendees);  // ⚠️ Overwrites optimistic state!
}
```

**Impact:** 
- Queued check-ins may be lost visually during sync
- UI flickers between states
- Users see attendees revert to unchecked, then check in again

**Recommendation:**
```typescript
// In fetchAttendees, preserve pending operations:
const attendees = (data ?? [])
  .map((record) => mapRecordToAttendee(record as AttendeeRecord))
  .filter((attendee): attendee is Attendee => attendee !== null);

// Apply pending operations BEFORE caching
const attendeesWithPending = await applyPendingCheckIns(eventId, attendees);

// Save merged state to cache
if (useCache) {
  await saveAttendeesToCache(eventId, attendeesWithPending);
}

return attendeesWithPending;
```

---

### 🔴 CRITICAL-4: No Error Boundary for Runtime Crashes

**Location:** Root layout and critical screens

**Issue:** The app has **no error boundaries** to catch and recover from React errors. Any unhandled exception (especially in realtime subscriptions, offline sync, or network reconnection logic) will crash the entire app.

**Impact:** 
- At the event, a single bug could crash the app for all users
- No graceful degradation
- Lost productivity as users force-quit and restart

**Recommendation:**
Add error boundary wrapper in `app/_layout.tsx`:

```typescript
import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error Boundary caught:', error, errorInfo);
    // TODO: Log to monitoring service (Sentry, etc.)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity style={styles.resetButton} onPress={this.handleReset}>
            <Text style={styles.resetButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

// Wrap root content:
export default function RootLayout() {
  // ...
  return (
    <ErrorBoundary>
      {!hideBanner && <EnvironmentBanner />}
      <SupabaseProvider>
        {/* ... */}
      </SupabaseProvider>
    </ErrorBoundary>
  );
}
```

---

### 🔴 CRITICAL-5: Missing Environment Variable Validation at Runtime

**Location:** `config/env.ts`, `services/supabase.ts`

**Issue:** Environment variables are logged as warnings but **do not throw** or prevent app startup when critical values are missing. The app will crash with cryptic errors later when Supabase client is used.

**Code:**
```typescript
// env.ts
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Missing Supabase environment variables. Check your Vercel config.');
}
// ⚠️ App continues!
```

**Impact:**
- App appears to start successfully
- Crashes on first Supabase call with "Invalid URL" or network errors
- Difficult to diagnose in production

**Recommendation:**
```typescript
// config/env.ts
export const validateConfig = () => {
  const errors: string[] = [];
  
  if (!SUPABASE_URL) errors.push('EXPO_PUBLIC_SUPABASE_URL is missing');
  if (!SUPABASE_ANON_KEY) errors.push('EXPO_PUBLIC_SUPABASE_ANON_KEY is missing');
  if (!REDIRECT_URL) errors.push('EXPO_PUBLIC_REDIRECT_URL is missing');
  
  if (errors.length > 0) {
    const message = `Critical configuration errors:\n${errors.join('\n')}`;
    console.error(message);
    throw new Error(message);
  }
  
  return true;
};

// app/_layout.tsx - call on mount
useEffect(() => {
  try {
    validateConfig();
  } catch (error) {
    Alert.alert(
      'Configuration Error',
      'The app is missing critical configuration. Please reinstall or contact support.',
      [{ text: 'OK', onPress: () => BackHandler.exitApp() }]
    );
  }
}, []);
```

---

## High Priority Issues (SHOULD FIX)

### 🟠 HIGH-1: Realtime Subscription Memory Leak

**Location:** `hooks/useRealtime.ts`, `services/realtime.ts`

**Issue:** The realtime status polling interval (5s) in `useRealtimeStatus` hook is **not cleaned up properly** if the component unmounts while a status update is in progress.

```typescript
useEffect(() => {
  const updateStatus = () => {
    if (channelName) {
      setStatus(getRealtimeConnectionStatus(channelName));
    }
    setAllStatuses(getAllRealtimeConnectionStatuses());
  };

  updateStatus();
  const interval = setInterval(updateStatus, 5000);

  return () => clearInterval(interval);  // ✅ Cleanup present
}, [channelName]);
```

**However**, in `services/realtime.ts`:
```typescript
// RealtimeManager.handleReconnection
const timeout = setTimeout(() => {
  this.reconnectTimeouts.delete(channelName);
  this.subscribeToAttendees(options, onChange);  // ⚠️ Recursive, no cleanup check
}, reconnectDelay * attempts);
```

If a component unmounts during reconnection delay, the timeout fires and tries to resubscribe, but the callback references may be stale.

**Impact:**
- Memory leaks from orphaned subscriptions
- Duplicate subscriptions on reconnection
- Performance degradation over time

**Recommendation:**
```typescript
// Add mounted check in reconnection handler
private handleReconnection(
  channelName: string,
  options: RealtimeSubscriptionOptions,
  onChange: (change: RealtimePostgresChangesPayload<any>) => void
) {
  // ... existing code ...

  const timeout = setTimeout(() => {
    // Check if subscription still exists (user hasn't unsubscribed)
    if (!this.channels.has(channelName)) {
      console.log(`Subscription ${channelName} was unsubscribed, skipping reconnect`);
      return;
    }
    
    this.reconnectTimeouts.delete(channelName);
    this.subscribeToAttendees(options, onChange);
  }, reconnectDelay * attempts);

  this.reconnectTimeouts.set(channelName, timeout);
}
```

---

### 🟠 HIGH-2: Network State Polling is Inefficient

**Location:** `services/syncManager.ts`, line 123-140

**Issue:** The sync manager polls network state every 5 seconds using `setInterval`. This is battery-intensive and has a 5-second lag for detecting reconnection.

```typescript
const pollInterval = setInterval(async () => {
  try {
    const state = await Network.getNetworkStateAsync();
    const isConnected = state.isConnected && state.isInternetReachable;

    if (isConnected !== lastConnected) {
      console.log(`Network state changed: ${isConnected ? 'online' : 'offline'}`);
      await handleNetworkChange(isConnected ?? false);
      lastConnected = isConnected ?? false;
    }
  } catch (error) {
    console.error('Error polling network state:', error);
  }
}, 5000);  // ⚠️ Inefficient polling
```

**Impact:**
- Battery drain
- Delayed sync triggers (up to 5s after reconnect)
- Users may think sync is broken

**Recommendation:**
Use NetInfo library (React Native standard) with event listeners:
```typescript
import NetInfo from '@react-native-community/netinfo';

export async function initSyncManager(): Promise<() => void> {
  // Check initial state
  const initialState = await NetInfo.fetch();
  let wasOffline = !initialState.isConnected || !initialState.isInternetReachable;

  // Set up event listener (more efficient than polling)
  const unsubscribe = NetInfo.addEventListener(state => {
    const isConnected = state.isConnected && state.isInternetReachable;
    
    if (isConnected !== !wasOffline) {
      console.log(`Network state changed: ${isConnected ? 'online' : 'offline'}`);
      handleNetworkChange(isConnected ?? false);
      wasOffline = !isConnected;
    }
  });

  // Trigger initial sync if online and have pending operations
  if (!wasOffline) {
    const stats = await getQueueStats();
    if (stats.pending > 0) {
      console.log(`Found ${stats.pending} pending operations, syncing...`);
      syncAllPending();
    }
  }

  return () => unsubscribe();
}
```

**Note:** Add `@react-native-community/netinfo` to dependencies.

---

### 🟠 HIGH-3: Deep Link Auth Callback Missing Error State

**Location:** `app/auth/callback.tsx`

**Issue:** The auth callback screen shows only a loading spinner and redirects after 500ms. If auth fails, users see:
1. Loading spinner
2. Redirect to home
3. **No indication that auth failed**

```typescript
export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/");  // ⚠️ Always redirects, even on error
    }, 500);
    
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
      <Text>Signing you in...</Text>
    </View>
  );
}
```

**Impact:**
- Users who click expired/invalid magic links see no error
- Confusion about whether sign-in worked
- Support burden

**Recommendation:**
```typescript
export default function AuthCallback() {
  const router = useRouter();
  const { session } = useSupabaseContext();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for session state to settle
    const timer = setTimeout(() => {
      if (session) {
        router.replace("/");
      } else {
        setError("Sign-in failed. The link may be invalid or expired.");
      }
    }, 2000);  // Give more time for session check
    
    return () => clearTimeout(timer);
  }, [router, session]);

  if (error) {
    return (
      <View style={styles.container}>
        <Ionicons name="alert-circle" size={48} color="#e74c3c" />
        <Text style={styles.errorTitle}>Sign-In Failed</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => router.replace("/")}
        >
          <Text style={styles.retryButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
      <Text style={styles.loadingText}>Signing you in...</Text>
    </View>
  );
}
```

---

### 🟠 HIGH-4: Missing Retry Logic in Offline Queue Sync

**Location:** `services/syncManager.ts`, `syncOperation` function

**Issue:** Failed sync operations are marked as failed and increment attempt count, but **are not automatically retried** even after the error is transient (e.g., network blip during sync).

```typescript
async function syncOperation(item: QueuedCheckIn): Promise<boolean> {
  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase.rpc('toggle_checkin', {
      p_attendee_id: item.attendeeId,
      p_checked: item.checkedIn,
    });

    if (error) {
      // Conflict handling...
      throw error;
    }

    await markSynced(item.id);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to sync check-in for ${item.attendeeId}:`, errorMessage);
    await markFailed(item.id, errorMessage);  // ⚠️ No retry!
    return false;
  }
}
```

**Impact:**
- Transient network errors cause permanent sync failures
- Users must manually trigger sync again
- Lost check-ins

**Recommendation:**
Add exponential backoff retry:
```typescript
async function syncOperation(item: QueuedCheckIn, retryCount = 0): Promise<boolean> {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [1000, 2000, 5000]; // ms
  
  try {
    const { error } = await supabase.rpc('toggle_checkin', {
      p_attendee_id: item.attendeeId,
      p_checked: item.checkedIn,
    });

    if (error) {
      // Check if retryable
      const isRetryable = error.message.includes('network') || 
                          error.message.includes('timeout') ||
                          error.code === 'PGRST301'; // Supabase service error
      
      if (isRetryable && retryCount < MAX_RETRIES) {
        console.log(`Retrying sync for ${item.attendeeId} (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[retryCount]));
        return syncOperation(item, retryCount + 1);
      }
      
      throw error;
    }

    await markSynced(item.id);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to sync after ${retryCount + 1} attempts:`, errorMessage);
    await markFailed(item.id, errorMessage);
    return false;
  }
}
```

---

### 🟠 HIGH-5: Edge Function Security - Missing Input Validation

**Location:** `supabase/functions/redeem_event_code/index.ts`

**Issue:** The `redeem_event_code` function accepts user input but only performs basic validation:

```typescript
const body = await req.json();
const rawCode: string = (body?.code || '').toString().trim();
const clientInstanceId: string | undefined = body?.clientInstanceId || undefined;

if (!rawCode) {
  return new Response(JSON.stringify({ error: 'Missing code' }), { status: 400 });
}
```

**Missing validations:**
- No max length check on `rawCode` (could be huge string → DoS)
- No sanitization of `clientInstanceId` (could be malicious JSON/XSS in logs)
- No rate limiting (user could spam code attempts)

**Impact:**
- DoS vulnerability
- Log injection
- Brute force code guessing

**Recommendation:**
```typescript
// Add validation
const MAX_CODE_LENGTH = 100;
const UUID_REGEX = /^[a-zA-Z0-9-]{8,128}$/;

const rawCode: string = (body?.code || '').toString().trim();
if (!rawCode || rawCode.length > MAX_CODE_LENGTH) {
  return new Response(
    JSON.stringify({ error: 'Invalid code format' }), 
    { status: 400 }
  );
}

const clientInstanceId: string | undefined = body?.clientInstanceId;
if (clientInstanceId && !UUID_REGEX.test(clientInstanceId)) {
  return new Response(
    JSON.stringify({ error: 'Invalid client instance ID' }), 
    { status: 400 }
  );
}

// Add rate limiting (Supabase Edge Function middleware or Upstash Redis)
const rateLimitKey = `redeem:${userId}`;
// ... implement rate limit check
```

---

## Medium Priority Issues (FIX WHEN POSSIBLE)

### 🟡 MEDIUM-1: Attendee List Performance with Large Events

**Location:** `app/(tabs)/index.tsx`, attendee rendering

**Issue:** The attendee list uses `FlatList` but lacks:
- `getItemLayout` optimization (causes layout thrashing)
- `windowSize` tuning
- Memoization of complex filter/sort operations on every render

Current filter logic runs on **every render**:
```typescript
const filteredAttendees = useMemo(() => {
  const lowerSearch = searchTerm.trim().toLowerCase();

  const filtered = attendees
    .filter((item) => {
      if (activeStatus === 'pending') return !item.checkedIn;
      if (activeStatus === 'checked-in') return item.checkedIn;
      return true;
    })
    .filter((item) => {
      if (!lowerSearch) return true;
      const haystack = `${item.attendeeName} ${item.groupName} ${item.tableNumber} ${item.ticketType}`.toLowerCase();
      return haystack.includes(lowerSearch);
    })
    .sort((a, b) => {
      const valueA = getComparableValue(a, sortKey).toLowerCase();
      const valueB = getComparableValue(b, sortKey).toLowerCase();
      const cmp = valueA.localeCompare(valueB, undefined, { sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  return filtered;
}, [attendees, activeStatus, searchTerm, sortKey, sortOrder]);
```

**Impact:** With 500+ attendees (likely at a gala):
- Noticeable lag when typing in search
- Scroll performance degrades
- Battery drain

**Recommendation:**
```typescript
// Add optimizations
<FlatList
  data={filteredAttendees}
  keyExtractor={(item) => item.id}
  renderItem={renderItem}
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT, // Define constant ~60px
    offset: ITEM_HEIGHT * index,
    index,
  })}
  windowSize={5}  // Reduce render window
  maxToRenderPerBatch={10}
  updateCellsBatchingPeriod={50}
  removeClippedSubviews={true}
  initialNumToRender={15}
  // ...
/>
```

Also debounce search:
```typescript
const [searchInput, setSearchInput] = useState('');
const [searchTerm, setSearchTerm] = useState('');

// Debounce search
useEffect(() => {
  const timer = setTimeout(() => {
    setSearchTerm(searchInput);
  }, 300);
  
  return () => clearTimeout(timer);
}, [searchInput]);
```

---

### 🟡 MEDIUM-2: RLS Policy Performance Concerns

**Location:** `checkin_supabase_initial.sql`

**Issue:** The RLS policies use subqueries extensively:

```sql
create or replace view public.my_events as
select e.id as event_id
from public.events e
where e.org_id in (select org_id from public.my_orgs)  -- ⚠️ Subquery
union
select em.event_id from public.event_members em where em.user_id = auth.uid();
```

Every attendee query executes:
```sql
using (event_id in (select event_id from public.my_events));
```

**Impact:** With 50+ concurrent users:
- Query planner may not optimize well
- High CPU usage
- Slow response times

**Recommendation:**
Add indexes:
```sql
-- Add covering index for my_events view
create index idx_events_org_user on public.events(org_id) 
  where org_id in (select org_id from public.organization_members);

create index idx_event_members_user_event on public.event_members(user_id, event_id);

-- Consider materialized view for heavy load
create materialized view public.user_event_access as
select 
  om.user_id,
  e.id as event_id,
  coalesce(em.role, om.role) as role
from public.organization_members om
join public.events e on e.org_id = om.org_id
left join public.event_members em on em.event_id = e.id and em.user_id = om.user_id;

create unique index on public.user_event_access(user_id, event_id);

-- Refresh periodically or on event creation
refresh materialized view concurrently public.user_event_access;
```

---

### 🟡 MEDIUM-3: Missing User Feedback During Long Operations

**Location:** Various admin operations in `app/(tabs)/admin.tsx`

**Issue:** Operations like "Reset All Check-Ins", "Sync Google Sheet", etc. have no progress indicators. Users don't know if it's working or hung.

```typescript
const handleResetAll = () => {
  Alert.alert(
    'Reset All Check-Ins',
    'This will move every attendee back to Pending. Continue?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          try {
            await resetAllCheckins(selectedEvent.eventId);  // ⚠️ No progress indicator
            emitRefreshAttendees({ silent: true });
            Alert.alert('Reset complete', 'All attendees marked pending.');
          } catch (err) {
            Alert.alert('Unable to reset', 'Please try again.');
          }
        }
      }
    ]
  );
};
```

**Impact:**
- User thinks app froze
- Taps button multiple times → duplicate operations
- Poor UX

**Recommendation:**
```typescript
const [resetting, setResetting] = useState(false);

const handleResetAll = () => {
  Alert.alert(
    'Reset All Check-Ins',
    'This will move every attendee back to Pending. Continue?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          setResetting(true);
          try {
            await resetAllCheckins(selectedEvent.eventId);
            emitRefreshAttendees({ silent: true });
            Alert.alert('Reset complete', 'All attendees marked pending.');
          } catch (err) {
            Alert.alert('Unable to reset', 'Please try again.');
          } finally {
            setResetting(false);
          }
        }
      }
    ]
  );
};

// In JSX
<ActionButton
  label={resetting ? "Resetting..." : "Reset All Check-Ins"}
  variant="danger"
  onPress={handleResetAll}
  disabled={!selectedEvent || !canManageRoster || resetting}
/>
```

---

### 🟡 MEDIUM-4: Insufficient Error Context in User Alerts

**Location:** Throughout app (error handling)

**Issue:** Many error alerts show generic messages without actionable context:

```typescript
} catch (err) {
  console.error('Magic link error (native):', err);
  Alert.alert('Sign-in Failed', err instanceof Error ? err.message : 'Unexpected error');
}
```

Users see cryptic Supabase error messages like "JWT expired" or "Invalid token" without guidance.

**Impact:**
- Users can't self-resolve
- Support overhead
- Frustration

**Recommendation:**
Create error translator utility:
```typescript
// utils/errorMessages.ts
export function getUserFriendlyError(error: unknown): {
  title: string;
  message: string;
  actions?: string[];
} {
  const err = error instanceof Error ? error : new Error('Unknown error');
  
  // Map common errors to user-friendly messages
  if (err.message.includes('JWT') || err.message.includes('expired')) {
    return {
      title: 'Session Expired',
      message: 'Your sign-in session has expired. Please sign in again.',
      actions: ['Sign In']
    };
  }
  
  if (err.message.includes('network') || err.message.includes('fetch')) {
    return {
      title: 'Connection Error',
      message: 'Unable to reach the server. Check your internet connection and try again.',
      actions: ['Retry']
    };
  }
  
  if (err.message.includes('RLS') || err.message.includes('permission')) {
    return {
      title: 'Permission Denied',
      message: 'You don\'t have permission to perform this action. Contact your event manager.',
      actions: ['OK']
    };
  }
  
  // Default
  return {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
    actions: ['OK']
  };
}

// Usage:
try {
  // ...
} catch (error) {
  const { title, message } = getUserFriendlyError(error);
  Alert.alert(title, message);
}
```

---

### 🟡 MEDIUM-5: Code Redemption Lacks Device Fingerprinting

**Location:** `supabase/functions/redeem_event_code/index.ts`

**Issue:** The `single_device` code feature relies on `clientInstanceId` from the client, but this is:
- Not generated or validated
- Can be spoofed (user can change it in request)
- Not tied to actual device hardware ID

```typescript
const clientInstanceId: string | undefined = body?.clientInstanceId || undefined;
if (!clientInstanceId) {
  return new Response(JSON.stringify({ error: 'Device binding required' }), { status: 400 });
}
```

**Impact:**
- Device-locked codes can be bypassed
- Not a secure way to limit code sharing

**Recommendation:**
Use expo-device or expo-application to generate stable device ID on client:
```typescript
// services/device.ts
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = '@checkin_device_id';

export async function getDeviceId(): Promise<string> {
  // Check cached ID
  const cached = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (cached) return cached;

  // Generate stable ID from device identifiers
  const id = [
    Application.androidId || Application.getIosIdForVendorAsync(),
    Device.modelName,
    Device.osVersion
  ].filter(Boolean).join('|');

  const deviceId = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    id
  );

  await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
}
```

---

## Low Priority Issues (NICE TO HAVE)

### 🔵 LOW-1: No Analytics/Monitoring

**Issue:** No crash reporting, performance monitoring, or usage analytics. If issues occur at the event, no telemetry to diagnose.

**Recommendation:** Add Sentry for error tracking and Firebase Analytics for usage metrics.

---

### 🔵 LOW-2: Hard-Coded Retry Limits

**Issue:** `MAX_RETRY_ATTEMPTS = 3` and `MAX_QUEUE_SIZE = 100` are hard-coded constants. Large events may need tuning.

**Recommendation:** Make configurable via settings or env vars.

---

### 🔵 LOW-3: No Accessibility Labels on Critical Actions

**Issue:** Some TouchableOpacity components lack `accessibilityLabel` and `accessibilityRole`, impacting screen reader users.

**Recommendation:** Audit and add accessibility props to all interactive elements.

---

### 🔵 LOW-4: Missing Changelog/Version Display

**Issue:** No in-app version number or changelog. Users can't tell which version they're running.

**Recommendation:** Add version in Settings tab from `app.config.js`.

---

### 🔵 LOW-5: Development/Debug Code in Production Build

**Location:** `app/_layout.tsx`, EnvironmentBanner

**Issue:** The environment banner and logs are shown even in production unless explicitly hidden via env var.

**Current code:**
```typescript
const hideBanner =
  (process.env.EXPO_PUBLIC_ENV || '').toLowerCase() === 'production' ||
  process.env.EXPO_PUBLIC_HIDE_BANNER === 'true';
```

**Risk:** Low, but professional apps should auto-hide debug UI in production.

**Recommendation:**
```typescript
const hideBanner = __DEV__ ? false : true;  // Hide in release builds
```

---

## Security Analysis

### Anon Key Exposure ✅ ACCEPTABLE
The Supabase anon key is exposed in the client app (standard pattern). Security relies on RLS policies, which appear properly configured.

### RLS Policies ✅ MOSTLY SECURE
Row-level security policies are comprehensive. One gap:
- **Checker role** update policy allows any column update (see SQL note about BEFORE UPDATE trigger). This should be enforced at DB level.

**Recommendation:** Add trigger or use dedicated RPC for checker updates.

### Edge Functions ⚠️ NEEDS WORK
- Missing rate limiting (HIGH priority)
- Input validation incomplete (HIGH priority)
- Service role key properly isolated ✅

### Deep Link Security ✅ ADEQUATE
Magic link auth flow is secure. Deep link handling validates tokens server-side.

---

## Performance Assessment

### Overall Performance: **GOOD** with caveats

**Strengths:**
- Efficient caching strategy
- Real-time subscriptions are well-architected
- Offline-first design reduces server load

**Weaknesses:**
- Large attendee lists (500+) may struggle without FlatList optimizations
- RLS subqueries could be slow under load
- Network polling is inefficient

**Stress Test Recommendations:**
1. Test with 1000 attendees
2. Simulate 10+ concurrent users on same event
3. Test rapid online/offline transitions
4. Measure memory usage over 4-hour session

---

## Deployment Readiness

### ✅ GOOD
- app.config.js properly configured
- EAS build config complete
- Environment variables structured correctly

### ⚠️ CONCERNS
1. **No rollback plan** — If critical bug discovered at event, how to revert?
2. **No pre-event dry run** — Recommend full dress rehearsal
3. **Supabase project not reviewed** — Can't verify Vault salt, RLS policies deployed, Edge Functions live

### Pre-Event Checklist:
- [ ] Deploy latest Edge Functions to Supabase
- [ ] Verify `get_code_salt()` RPC works and Vault secret is set
- [ ] Test magic link emails from production Supabase project
- [ ] Verify redirect URLs point to production app scheme
- [ ] Test app with production Supabase URL (not dev project)
- [ ] Load test with simulated 100+ attendees
- [ ] Confirm admin/manager/checker roles work in production
- [ ] Test offline → online sync with real data
- [ ] Verify iOS and Android builds install and run
- [ ] Print QR code for event access codes (test scanner)

---

## Recommendations Summary

### 🚨 MUST FIX BEFORE EVENT (ETA: 4-6 hours)
1. **CRITICAL-1:** Fix auth session race condition
2. **CRITICAL-2:** Add optimistic locking to prevent concurrent check-in conflicts
3. **CRITICAL-3:** Fix offline queue cache invalidation bug
4. **CRITICAL-4:** Add error boundary to prevent app crashes
5. **CRITICAL-5:** Add runtime env validation with user-friendly error

### 🔶 SHOULD FIX (ETA: 2-4 hours)
1. **HIGH-1:** Fix realtime subscription memory leak
2. **HIGH-2:** Replace network polling with event-driven NetInfo
3. **HIGH-3:** Add error state to auth callback screen
4. **HIGH-4:** Add retry logic to offline sync
5. **HIGH-5:** Add input validation and rate limiting to edge functions

### 📋 FIX WHEN POSSIBLE (Post-Event)
1. Optimize attendee list rendering for 500+ items
2. Add RLS policy indexes
3. Add progress indicators to long operations
4. Improve error messages
5. Secure device fingerprinting for single-device codes

### 🎯 NICE TO HAVE (Future Releases)
1. Analytics and monitoring
2. Configurable retry/queue limits
3. Accessibility improvements
4. In-app version display
5. Remove debug code from production

---

## Final Verdict

**Production Readiness: 72/100**

The app is **NOT PRODUCTION-READY** without addressing the 5 CRITICAL issues. With those fixes applied and tested, confidence score would increase to **88/100** — acceptable for a controlled event environment.

**Primary Risks:**
1. **Concurrent check-in conflicts** → Data integrity issues
2. **Session restore bugs** → User lockouts
3. **Offline sync data loss** → Lost check-ins

**Mitigations:**
- Fix CRITICAL issues
- Conduct dry run with 2+ devices
- Have backup plan (paper roster)
- Designate one "admin" device with latest build
- Monitor Supabase dashboard during event for errors

**Confidence Level:** After fixes: **HIGH** for event success
**Without fixes:** **MEDIUM-LOW** (significant risk of disruption)

---

## Appendix: Code Quality & Architecture

### Strengths ⭐
- Well-structured service layer
- Good separation of concerns
- Comprehensive type safety
- Thoughtful offline-first design
- Real-time architecture is sound

### Weaknesses ⚠️
- Missing error boundaries
- Inconsistent error handling
- Lack of centralized logging
- No testing infrastructure (no tests found)

### Testing Gaps 🧪
- **No unit tests** for critical services (attendees, offlineQueue, syncManager)
- **No integration tests** for auth flow, realtime sync
- **No E2E tests** for user workflows

**Recommendation:** Add Jest tests for at least offline queue and sync logic before event.

---

**Report Compiled:** February 15, 2026, 12:45 EST  
**Next Review:** After CRITICAL fixes applied  
**Contact:** Main Agent for implementation assistance

---

_This report represents an independent technical assessment. All findings should be validated through testing before deployment._
