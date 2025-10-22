/**
 * Lintnotes
 * - Purpose: Main Check-In screen. Lists attendees for the selected event with search/sort, supports check-in/undo,
 *             group/table bulk actions, and realtime updates. Integrates auto-refresh and pull-to-refresh.
 * - Exports: default CheckInScreen (React component)
 * - Major deps: react-native UI, expo-router navigation hooks, react-native-gesture-handler Swipeable,
 *               services/attendees, services/attendeeEvents, hooks/useSupabase, hooks/usePermissions, components/ActionButton
 * - Side effects: Subscribes to realtime attendee changes while mounted; sets nav header options; timers for auto-refresh.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  ListRenderItem,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ParamListBase } from '@react-navigation/native';
import {
  NativeStackNavigationOptions,
  NativeStackNavigationProp
} from '@react-navigation/native-stack';
import { useNavigation } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';

import {
  Attendee,
  AttendeeChange,
  fetchAttendees,
  subscribeAttendees,
  syncAttendeesCache,
  toggleCheckin
} from '../../services/attendees';
import {
  addRefreshListener,
  addAutoRefreshListener,
  getAutoRefreshInterval,
  RefreshOptions
} from '../../services/attendeeEvents';
import { useSupabase } from '../../hooks/useSupabase';
import { usePermissions } from '../../hooks/usePermissions';
import ActionButton from '../../components/ActionButton';
import { RequestInfoModal } from '../../components/RequestInfoModal';
import SafeAsyncStorage from '../../utils/safeAsyncStorage';
import { validateCheckerLink } from '../../services/checkerLinks';

type CheckInStatus = 'pending' | 'checked-in';
const segments: CheckInStatus[] = ['pending', 'checked-in'];
const SORT_OPTIONS = [
  { key: 'attendeeName', label: 'Attendee' },
  { key: 'groupName', label: 'Group' },
  { key: 'tableNumber', label: 'Table' },
  { key: 'ticketType', label: 'Ticket' }
] as const;

type Navigation = NativeStackNavigationProp<ParamListBase>;

type SortKey = (typeof SORT_OPTIONS)[number]['key'];
type SortOrder = 'asc' | 'desc';

const getComparableValue = (attendee: Attendee, key: SortKey): string => {
  switch (key) {
    case 'attendeeName':
      return attendee.attendeeName;
    case 'groupName':
      return attendee.groupName;
    case 'tableNumber':
      return attendee.tableNumber;
    case 'ticketType':
      return attendee.ticketType;
    default:
      return '';
  }
};

export default function CheckInScreen() {
  const navigation = useNavigation<Navigation>();
  const {
    session,
    selectedEvent,
    events,
    setSelectedEventId,
    loading: supabaseLoading,
    signIn
  } = useSupabase();
  const { canToggleCheckins, canViewAttendees } = usePermissions();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [activeStatus, setActiveStatus] = useState<CheckInStatus>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('attendeeName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [sortsVisible, setSortsVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefreshInterval, setAutoRefreshIntervalState] = useState<number>(
    getAutoRefreshInterval()
  );
  const [pendingModal, setPendingModal] = useState<{
    attendee: Attendee;
    action: 'check-in' | 'undo';
    origin: 'tap' | 'swipe';
  } | null>(null);
  const [groupPrompt, setGroupPrompt] = useState<Attendee | null>(null);
  const [requestInfoModalVisible, setRequestInfoModalVisible] = useState(false);
  const [checkerMode, setCheckerMode] = useState(false);
  const [checkerEventId, setCheckerEventId] = useState<string | null>(null);
  const lastTapRef = useRef<{ id: string; timestamp: number } | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check for checker token on mount
  useEffect(() => {
    (async () => {
      try {
        const checkerToken = await SafeAsyncStorage.getItem('checker_token');
        const eventId = await SafeAsyncStorage.getItem('checker_event_id');
        
        if (checkerToken && eventId) {
          // Validate the checker token
          const result = await validateCheckerLink(checkerToken);
          if (result && result.event_id === eventId) {
            setCheckerMode(true);
            setCheckerEventId(eventId);
            // Auto-select this event if not already authenticated
            if (!session) {
              setSelectedEventId(eventId);
            }
          } else {
            // Invalid or expired token - clear it
            await SafeAsyncStorage.removeItem('checker_token');
            await SafeAsyncStorage.removeItem('checker_event_id');
          }
        }
      } catch (err) {
        console.error('Failed to validate checker token:', err);
      }
    })();
  }, []);

  const totals = useMemo(() => {
    const pending = attendees.filter((item) => !item.checkedIn).length;
    const checkedIn = attendees.filter((item) => item.checkedIn).length;

    return {
      total: attendees.length,
      pending,
      checkedIn
    };
  }, [attendees]);

  const headerEventName = useMemo(() => {
    if (selectedEvent?.eventName) {
      return selectedEvent.eventName;
    }
    if (supabaseLoading) {
      return 'Loading events…';
    }
    if (!session) {
      return 'Sign in to continue';
    }
    return 'Select an event';
  }, [selectedEvent?.eventName, supabaseLoading, session]);

  const loadAttendees = useCallback(
    async (showSpinner: boolean, options?: RefreshOptions) => {
      const silent = options?.silent ?? false;
      const stopIndicators = () => {
        setLoading(false);
        if (!silent) {
          setRefreshing(false);
        }
      };

      // Allow loading if either session exists OR checker mode is active
      if (!session && !checkerMode) {
        stopIndicators();
        setAttendees([]);
        setError(null);
        return;
      }

      // Use checker event ID if in checker mode without session
      const eventId = selectedEvent?.eventId || (checkerMode ? checkerEventId : null);
      if (!eventId) {
        stopIndicators();
        setAttendees([]);
        setError(null);
        return;
      }

      if (showSpinner) {
        setLoading(true);
      } else if (!silent) {
        setRefreshing(true);
      }

      try {
        const data = await fetchAttendees(eventId);
        setAttendees(data);
        setError(null);
      } catch (err) {
        setError('Unable to load attendees.');
      } finally {
        stopIndicators();
      }
    },
    [selectedEvent?.eventId, session, checkerMode, checkerEventId]
  );

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const initialise = async () => {
      // Determine the event ID to use
      const eventId = selectedEvent?.eventId || (checkerMode ? checkerEventId : null);
      
      if ((!session && !checkerMode) || !eventId) {
        await loadAttendees(false);
        return;
      }

      await loadAttendees(true);
      if (!isMounted) return;

      // Only subscribe to realtime if we have a session (not in checker mode)
      if (session) {
        unsubscribe = subscribeAttendees(
          eventId,
          (change) => {
            if (!isMounted) return;
            setAttendees((prev) => {
              const updated = applyAttendeeChange(prev, change);
              // Sync cache after realtime update
              void syncAttendeesCache(eventId, updated);
              return updated;
            });
          },
          () => {
            // Auto-refresh attendees when realtime reconnects
            console.log('🔄 Realtime reconnected, auto-refreshing attendees');
            void loadAttendees(false, { silent: true });
          }
        );
      }
    };

    void initialise();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [loadAttendees, selectedEvent?.eventId, session, checkerMode, checkerEventId]);

  useEffect(() => {
    const remove = addRefreshListener((options) => {
      void loadAttendees(false, options);
    });
    return remove;
  }, [loadAttendees]);

  useEffect(() => {
    const remove = addAutoRefreshListener((interval) => {
      setAutoRefreshIntervalState(interval);
    });
    return remove;
  }, []);

  useEffect(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (autoRefreshInterval > 0) {
      refreshTimerRef.current = setInterval(() => {
        void loadAttendees(false, { silent: true });
      }, autoRefreshInterval);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [autoRefreshInterval, loadAttendees]);

  useLayoutEffect(() => {
    const options: NativeStackNavigationOptions = {
      headerLargeTitle: false,
      headerTitleAlign: 'center',
      headerTintColor: '#1f1f1f',
      headerShadowVisible: false,
      // Use a custom background so we can round corners without warnings
      headerStyle: {
        backgroundColor: 'transparent',
      },
      headerBackground: () => (
        <View style={styles.headerBg}>
          <View style={styles.headerBgSheen} />
        </View>
      ),
      headerTitle: () => (
        <View style={styles.headerTitleWrapper}>
          <Text
            style={styles.headerTitle}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {headerEventName}
          </Text>
          <Text
            style={styles.headerSubtitle}
            accessibilityLabel={`Totals. ${totals.pending} pending, ${totals.checkedIn} checked in, ${totals.total} total`}
          >
            {`${totals.pending} pending • ${totals.checkedIn} checked • ${totals.total} total`}
          </Text>
        </View>
      )
    };

    navigation.setOptions(options);
  }, [headerEventName, navigation, totals]);

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

  const openConfirmation = useCallback(
    (attendee: Attendee, action: 'check-in' | 'undo', origin: 'tap' | 'swipe', close?: () => void) => {
      setPendingModal({ attendee, action, origin });
      close?.();
    },
    []
  );

  const handleConfirm = useCallback(
    async (attendee: Attendee, makeCheckedIn: boolean) => {
      if (!canToggleCheckins && !checkerMode) {
        Alert.alert('Permission Denied', 'You do not have permission to check in attendees.');
        return;
      }

      try {
        await toggleCheckin(attendee.id, makeCheckedIn);
        setError(null);
        setAttendees((prev) =>
          prev.map((existing) =>
            existing.id === attendee.id
              ? { 
                  ...existing, 
                  checkedIn: makeCheckedIn,
                  checkedInAt: makeCheckedIn ? new Date().toISOString() : null,
                  checkedInBy: makeCheckedIn ? 'current-user' : null
                }
              : existing
          )
        );
      } catch (err) {
        setError('Unable to update attendee.');
        Alert.alert('Update failed', 'Please try again.');
      }
    },
    [canToggleCheckins, checkerMode]
  );

  const handleGroupAction = useCallback(
    async (attendee: Attendee, scope: 'group' | 'table') => {
      if (!canToggleCheckins && !checkerMode) {
        Alert.alert('Permission Denied', 'You do not have permission to check in attendees.');
        return;
      }

      const normalizedGroup = attendee.groupName.toLowerCase();
      const normalizedTable = attendee.tableNumber.toLowerCase();

      const targets = attendees.filter((candidate) =>
        scope === 'group'
          ? candidate.groupName.toLowerCase() === normalizedGroup
          : candidate.tableNumber.toLowerCase() === normalizedTable
      );

      if (!targets.length) return;

      try {
        await Promise.all(targets.map((target) => toggleCheckin(target.id, true)));
        setAttendees((prev) =>
          prev.map((existing) =>
            targets.some((target) => target.id === existing.id)
              ? { 
                  ...existing, 
                  checkedIn: true,
                  checkedInAt: new Date().toISOString(),
                  checkedInBy: 'current-user'
                }
              : existing
          )
        );
        setError(null);
        await loadAttendees(false, { silent: true });
      } catch (err) {
        setError('Unable to check in group.');
        Alert.alert('Group check-in failed', 'Please try again.');
      }
    },
    [attendees, loadAttendees, canToggleCheckins, checkerMode]
  );

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortOrder('asc');
      }
    },
    [sortKey]
  );

  const renderItem = useCallback<ListRenderItem<Attendee>>(
    ({ item }) => {
      let swipeRef: Swipeable | null = null;
      const isPending = !item.checkedIn;
      const actionLabel = isPending ? 'Check In' : 'Undo';
      const actionColor = isPending ? '#27ae60' : '#c0392b';
      const groupLabel = item.groupName || 'No group';
      const tableLabel = item.tableNumber || '—';
      const ticketLabel = item.ticketType || '—';

      return (
        <Swipeable
          ref={(ref) => {
            swipeRef = ref;
          }}
          friction={2}
          leftThreshold={72}
          overshootLeft={false}
          renderLeftActions={() => (
            <View style={[styles.swipeAction, { backgroundColor: actionColor }]}> 
              <Text style={styles.swipeActionLabel}>{actionLabel}</Text>
            </View>
          )}
          onSwipeableLeftOpen={() =>
            openConfirmation(item, isPending ? 'check-in' : 'undo', 'swipe', () => swipeRef?.close())
          }
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              const now = Date.now();
              if (lastTapRef.current && lastTapRef.current.id === item.id && now - lastTapRef.current.timestamp < 400) {
                lastTapRef.current = null;
                openConfirmation(item, isPending ? 'check-in' : 'undo', 'tap', () => swipeRef?.close());
              } else {
                lastTapRef.current = { id: item.id, timestamp: now };
              }
            }}
            style={styles.row}
            accessibilityRole="button"
            accessibilityLabel={`${item.attendeeName}. Group ${groupLabel}. Table ${tableLabel}. Ticket ${ticketLabel}.`}
          >
            <View style={styles.rowInfo}>
              <Text style={styles.rowName}>{item.attendeeName}</Text>
              <Text style={styles.rowMeta}>{`${groupLabel} • Table ${tableLabel} • ${ticketLabel}`}</Text>
            </View>
            <View style={[styles.statusPill, isPending ? styles.statusPending : styles.statusChecked]}>
              <Text style={styles.statusPillLabel}>{isPending ? 'Pending' : 'Checked'}</Text>
            </View>
          </TouchableOpacity>
        </Swipeable>
      );
    },
    [openConfirmation]
  );

  const renderFilters = useCallback(() => (
    <View style={styles.filtersContainer}>
      <View style={styles.segmentContainer}>
        {segments.map((segment) => {
          const isActive = activeStatus === segment;
          return (
            <View key={segment} style={styles.segmentWrapper}>
              <TouchableOpacity
                onPress={() => setActiveStatus(segment)}
                accessibilityRole="button"
                accessibilityLabel={`Show ${segment === 'pending' ? 'pending attendees' : 'checked-in attendees'}`}
                style={styles.segmentPressable}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.segmentLabel, isActive ? styles.segmentLabelActive : styles.segmentLabelInactive]}
                >
                  {segment === 'pending' ? 'Pending' : 'Checked In'}
                </Text>
              </TouchableOpacity>
              {isActive && <View style={styles.segmentIndicator} />}
            </View>
          );
        })}
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color="#7c7c7c" accessibilityElementsHidden />
        <TextInput
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Search attendees"
          placeholderTextColor="#a0a0a0"
          style={styles.searchInput}
          autoCorrect={false}
          accessibilityLabel="Search attendees"
          clearButtonMode="while-editing"
        />
        <TouchableOpacity
          onPress={() => setSortsVisible((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel={sortsVisible ? 'Hide sort options' : 'Show sort options'}
          style={styles.sortToggle}
          activeOpacity={0.6}
        >
          <Ionicons
            name={sortsVisible ? 'chevron-up' : 'swap-vertical'}
            size={18}
            color="#007aff"
          />
        </TouchableOpacity>
      </View>

      {sortsVisible && (
        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((option) => {
            const isActive = sortKey === option.key;
            const arrow = isActive ? (sortOrder === 'asc' ? '↑' : '↓') : '';
            return (
              <TouchableOpacity
                key={option.key}
                onPress={() => toggleSort(option.key)}
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${option.label}`}
                style={[styles.sortChip, isActive ? styles.sortChipActive : null]}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.sortChipLabel, isActive ? styles.sortChipLabelActive : null]}
                >
                  {`${option.label} ${arrow}`.trim()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  ), [activeStatus, error, searchTerm, sortsVisible, sortKey, sortOrder, toggleSort]);

  if (supabaseLoading && !checkerMode) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1f1f1f" />
        <Text style={styles.loadingText}>Connecting to Supabase…</Text>
      </View>
    );
  }

  if (!session && !checkerMode) {
    return (
      <View style={styles.pageContainer}>
        <View style={styles.loggedOutContainer}>
          <Text style={styles.heading}>Event Check-In</Text>
          <Text style={styles.loggedOutDescription}>
            Ask your event planner to invite you to an event and you'll be able to check in attendees.{'\n\n'}
            If you're an event planner and want to use this app, tap below to request more info.
          </Text>
        </View>
        
        {/* Floating Buttons for Logged-Out State */}
        <View style={styles.loggedOutButtonContainer}>
          <TouchableOpacity
            style={styles.goldButton}
            onPress={() => setRequestInfoModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.goldButtonText}>Request Info</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.goldButton}
            onPress={() => void signIn()}
            activeOpacity={0.8}
          >
            <Text style={styles.goldButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* Request Info Modal */}
        <RequestInfoModal
          visible={requestInfoModalVisible}
          onClose={() => setRequestInfoModalVisible(false)}
        />
      </View>
    );
  }

  if (!selectedEvent && !checkerMode) {
    // No events available
    if (events.length === 0) {
      return (
        <View style={styles.authContainer}>
          <Ionicons name="calendar-outline" size={40} color="#8e8e93" accessibilityElementsHidden />
          <Text style={styles.authTitle}>No events assigned to your account</Text>
          <Text style={styles.authSubtitle}>
            Contact an event manager to get access to events.
          </Text>
        </View>
      );
    }

    // Multiple events - show selection
    if (events.length > 1) {
      return (
        <View style={styles.authContainer}>
          <Ionicons name="calendar-outline" size={40} color="#8e8e93" accessibilityElementsHidden />
          <Text style={styles.authTitle}>Choose an event</Text>
          <Text style={styles.authSubtitle}>
            Select which event you want to manage:
          </Text>
          <View style={styles.eventList}>
            {events.map((event) => (
              <TouchableOpacity
                key={event.eventId}
                style={styles.eventItem}
                onPress={() => setSelectedEventId(event.eventId)}
                activeOpacity={0.7}
              >
                <View style={styles.eventInfo}>
                  <Text style={styles.eventName}>{event.eventName}</Text>
                  <Text style={styles.eventOrg}>{event.orgName}</Text>
                  {event.role && (
                    <Text style={styles.eventRole}>Role: {event.role}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color="#8e8e93" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    // Single event - should auto-select, but just in case
    return (
      <View style={styles.authContainer}>
        <Ionicons name="calendar-outline" size={40} color="#8e8e93" accessibilityElementsHidden />
        <Text style={styles.authTitle}>Loading event...</Text>
        <Text style={styles.authSubtitle}>
          Setting up your event access.
        </Text>
      </View>
    );
  }

  if (!canViewAttendees && !checkerMode) {
    return (
      <View style={styles.authContainer}>
        <Ionicons name="lock-closed-outline" size={40} color="#8e8e93" accessibilityElementsHidden />
        <Text style={styles.authTitle}>Access Restricted</Text>
        <Text style={styles.authSubtitle}>
          You do not have permission to view attendees for this event. Contact an event manager for access.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1f1f1f" />
        <Text style={styles.loadingText}>Loading attendees…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <View style={styles.filtersOuter}>{renderFilters()}</View>
      <FlatList
        data={filteredAttendees}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void loadAttendees(false);
            }}
            tintColor="#1f1f1f"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={40} color="#8e8e93" accessibilityElementsHidden />
            <Text style={styles.emptyTitle}>No attendees found</Text>
            <Text style={styles.emptySubtitle}>Adjust your filters or try another list.</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.itemDivider} />}
        ListFooterComponent={<View style={styles.footerSpacer} />}
      />

      <Modal
        visible={pendingModal !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setPendingModal(null)}
      >
        <View style={styles.modalBackdrop}>
          {pendingModal && (
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {pendingModal.action === 'check-in' ? 'Confirm Check-In' : 'Undo Check-In'}
              </Text>
              <View style={styles.modalContent}>
                <Text style={styles.modalName}>{pendingModal.attendee.attendeeName}</Text>
                <Text style={styles.modalMeta}>{pendingModal.attendee.groupName || 'No group'}</Text>
                <Text style={styles.modalMetaBold}>{`Table ${pendingModal.attendee.tableNumber || '—'}`}</Text>
                <Text style={styles.modalMeta}>{pendingModal.attendee.ticketType || '—'}</Text>
              </View>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalPrimaryButton]}
                onPress={async () => {
                  const isCheckIn = pendingModal.action === 'check-in';
                  await handleConfirm(pendingModal.attendee, isCheckIn);
                  setPendingModal(null);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.modalPrimaryLabel}>
                  {pendingModal.action === 'check-in' ? 'Confirm Check-In' : 'Confirm Undo'}
                </Text>
              </TouchableOpacity>

              {pendingModal.action === 'check-in' && (
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSecondaryButton]}
                  onPress={() => {
                    setGroupPrompt(pendingModal.attendee);
                    setPendingModal(null);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalSecondaryLabel}>Check In Group</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setPendingModal(null)}
              >
                <Text style={styles.modalCancelLabel}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      <Modal
        visible={groupPrompt !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setGroupPrompt(null)}
      >
        <View style={styles.modalBackdrop}>
          {groupPrompt && (
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Check In Multiple</Text>
              <View style={styles.modalContent}>
                <Text style={styles.modalName}>{groupPrompt.attendeeName}</Text>
                <Text style={styles.modalMeta}>Group: {groupPrompt.groupName || 'No group'}</Text>
                <Text style={styles.modalMetaBold}>{`Table ${groupPrompt.tableNumber || '—'}`}</Text>
                <Text style={styles.modalMeta}>{groupPrompt.ticketType || '—'}</Text>
              </View>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalPrimaryButton]}
                onPress={async () => {
                  await handleGroupAction(groupPrompt, 'group');
                  setGroupPrompt(null);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.modalPrimaryLabel}>Check In Entire Group</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalSecondaryButton]}
                onPress={async () => {
                  await handleGroupAction(groupPrompt, 'table');
                  setGroupPrompt(null);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.modalSecondaryLabel}>
                  {groupPrompt.tableNumber
                    ? `Check In Table ${groupPrompt.tableNumber}`
                    : 'Check In Table'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setGroupPrompt(null)}
              >
                <Text style={styles.modalCancelLabel}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function applyAttendeeChange(current: Attendee[], change: AttendeeChange): Attendee[] {
  const { type, attendee, payload } = change;

  if (type === 'DELETE') {
    const idToRemove = attendee?.id ?? (payload.old ? String((payload.old as { id?: string | number }).id ?? '') : '');
    if (!idToRemove) return current;
    return current.filter((existing) => existing.id !== idToRemove);
  }

  if (attendee) {
    const exists = current.some((existing) => existing.id === attendee.id);
    if (exists) {
      return current.map((existing) => (existing.id === attendee.id ? attendee : existing));
    }
    return [...current, attendee];
  }

  return current;
}

const styles = StyleSheet.create({
  headerTitleWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    minHeight: 64,
  },
  headerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFD54F',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 2,
  },
  headerBgSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'System',
    color: '#111',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'System',
    fontWeight: '500',
    color: '#444',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f2f3f5'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f2f3f5'
  },
  loadingText: {
    marginTop: 12,
    color: '#1f1f1f',
    fontSize: 16,
    fontFamily: 'System'
  },
  pageContainer: {
    flex: 1,
    backgroundColor: '#f4f5f7'
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1f1f1f'
  },
  loggedOutContainer: {
    padding: 24,
    gap: 24,
    paddingBottom: 200,
    backgroundColor: '#f4f5f7',
    flexGrow: 1,
    justifyContent: 'center'
  },
  loggedOutDescription: {
    fontSize: 18,
    color: '#4a4a4a',
    lineHeight: 26,
    textAlign: 'center'
  },
  loggedOutButtonContainer: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    gap: 16
  },
  goldButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6
  },
  goldButtonText: {
    color: '#1f1f1f',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  authContainer: {
    flex: 1,
    backgroundColor: '#f2f3f5',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12
  },
  authTitle: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'System',
    color: '#050505'
  },
  authSubtitle: {
    fontSize: 14,
    fontFamily: 'System',
    color: '#4a4a4a',
    textAlign: 'center',
    lineHeight: 20
  },
  filtersOuter: {
    backgroundColor: '#f2f3f5',
    borderBottomWidth: 1,
    borderBottomColor: '#d9d9dc'
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8
  },
  listContent: {
    paddingBottom: 24
  },
  segmentContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  segmentWrapper: {
    flex: 1,
    alignItems: 'center'
  },
  segmentPressable: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'System',
    paddingVertical: 4,
    color: '#8e8e93'
  },
  segmentLabelActive: {
    color: '#1f1f1f'
  },
  segmentLabelInactive: {
    color: '#8e8e93'
  },
  segmentIndicator: {
    marginTop: 2,
    width: 44,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#007aff'
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#e9eaec',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'System',
    color: '#1f1f1f'
  },
  sortToggle: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f4f4f8'
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  sortChip: {
    backgroundColor: '#f1f1f5',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  sortChipActive: {
    backgroundColor: '#1f1f1f'
  },
  sortChipLabel: {
    fontSize: 13,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#1f1f1f'
  },
  sortChipLabelActive: {
    color: '#ffffff'
  },
  swipeAction: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  swipeActionLabel: {
    fontSize: 15,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#ffffff'
  },
  errorBanner: {
    backgroundColor: '#fdecea',
    padding: 12,
    borderRadius: 12
  },
  errorText: {
    color: '#c0392b',
    fontSize: 14,
    fontFamily: 'System',
    textAlign: 'center'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff'
  },
  rowInfo: {
    flex: 1,
    paddingRight: 12
  },
  rowName: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: 'System',
    color: '#1f1f1f'
  },
  rowMeta: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: 'System',
    color: '#8e8e93'
  },
  statusPill: {
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center'
  },
  statusPending: {
    backgroundColor: '#f4f4f6'
  },
  statusChecked: {
    backgroundColor: '#d1f7de'
  },
  statusPillLabel: {
    fontSize: 12,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#1f1f1f'
  },
  itemDivider: {
    height: 1,
    marginLeft: 16,
    backgroundColor: '#ececed'
  },
  footerSpacer: {
    height: 32
  },
  emptyState: {
    marginTop: 64,
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'System',
    color: '#1f1f1f'
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'System',
    color: '#6e6e73',
    textAlign: 'center'
  },
  headerIconButton: {
    padding: 6
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24
  },
  modalCard: {
    width: Dimensions.get('window').width - 48,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 28,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    gap: 18
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#1f1f1f'
  },
  modalContent: {
    gap: 6
  },
  modalName: {
    fontSize: 20,
    fontFamily: 'System',
    fontWeight: '700',
    color: '#050505'
  },
  modalMeta: {
    fontSize: 14,
    fontFamily: 'System',
    color: '#5c5c5c'
  },
  modalMetaBold: {
    fontSize: 16,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#1f1f1f'
  },
  modalButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center'
  },
  modalPrimaryButton: {
    backgroundColor: '#27ae60'
  },
  modalPrimaryLabel: {
    fontSize: 16,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#ffffff'
  },
  modalSecondaryButton: {
    backgroundColor: '#f4f4f6'
  },
  modalSecondaryLabel: {
    fontSize: 16,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#1f1f1f'
  },
  modalCancel: {
    marginTop: 4,
    alignItems: 'center'
  },
  modalCancelLabel: {
    fontSize: 15,
    fontFamily: 'System',
    fontWeight: '500',
    color: '#007aff'
  },
  eventList: {
    width: '100%',
    marginTop: 20,
    gap: 12
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#e5e5e7',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  eventInfo: {
    flex: 1,
    gap: 4
  },
  eventName: {
    fontSize: 16,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#1f1f1f'
  },
  eventOrg: {
    fontSize: 14,
    fontFamily: 'System',
    color: '#6e6e73'
  },
  eventRole: {
    fontSize: 12,
    fontFamily: 'System',
    color: '#007aff',
    fontWeight: '500'
  }
});
