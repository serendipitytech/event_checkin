/**
 * Lintnotes
 * - Purpose: Manage syncing of offline queue when connectivity returns.
 * - Exports: initSyncManager, syncAllPending, getSyncStatus, addSyncListener
 * - Major deps: expo-network, offlineQueue, supabase
 * - Side effects: Subscribes to network state changes; syncs queued operations.
 */
import * as Network from 'expo-network';
import {
  getPendingOperations,
  markSynced,
  markFailed,
  clearOldSyncedOperations,
  getQueueStats,
  type QueuedCheckIn,
  type QueueStats,
} from './offlineQueue';
import { getSupabaseClient } from './supabase';
import { emitRefreshAttendees } from './attendeeEvents';

export type SyncStatus = {
  isSyncing: boolean;
  lastSyncAt: number | null;
  lastSyncResult: 'success' | 'partial' | 'failed' | null;
  pendingCount: number;
  syncedCount: number;
  failedCount: number;
};

type SyncListener = (status: SyncStatus) => void;

// Module state
let isSyncing = false;
let lastSyncAt: number | null = null;
let lastSyncResult: 'success' | 'partial' | 'failed' | null = null;
let networkSubscription: (() => void) | null = null;
let wasOffline = false;

const syncListeners = new Set<SyncListener>();

/**
 * Add a listener for sync status changes
 */
export function addSyncListener(listener: SyncListener): () => void {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

/**
 * Emit sync status to all listeners
 */
async function emitSyncStatus(): Promise<void> {
  const stats = await getQueueStats();
  const status: SyncStatus = {
    isSyncing,
    lastSyncAt,
    lastSyncResult,
    pendingCount: stats.pending,
    syncedCount: stats.synced,
    failedCount: stats.failed,
  };

  syncListeners.forEach((listener) => {
    try {
      listener(status);
    } catch (error) {
      console.error('Sync listener error:', error);
    }
  });
}

/**
 * Sync a single queued check-in operation
 */
async function syncOperation(item: QueuedCheckIn): Promise<boolean> {
  const supabase = getSupabaseClient();

  try {
    // Call the toggle_checkin RPC
    const { error } = await supabase.rpc('toggle_checkin', {
      p_attendee_id: item.attendeeId,
      p_checked: item.checkedIn,
    });

    if (error) {
      // Check if it's a conflict (server state differs)
      // In this case, we still mark as synced since server is source of truth
      if (error.message.includes('already')) {
        console.log(`Conflict for ${item.attendeeId}: server state differs, accepting server state`);
        await markSynced(item.id);
        return true;
      }

      throw error;
    }

    await markSynced(item.id);
    console.log(`Synced check-in for attendee ${item.attendeeId}`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to sync check-in for ${item.attendeeId}:`, errorMessage);
    await markFailed(item.id, errorMessage);
    return false;
  }
}

/**
 * Sync all pending operations
 */
export async function syncAllPending(): Promise<{
  success: boolean;
  synced: number;
  failed: number;
  total: number;
}> {
  if (isSyncing) {
    console.log('Sync already in progress, skipping');
    return { success: false, synced: 0, failed: 0, total: 0 };
  }

  // Check network connectivity first
  const networkState = await Network.getNetworkStateAsync();
  if (!networkState.isConnected || !networkState.isInternetReachable) {
    console.log('No network connectivity, skipping sync');
    return { success: false, synced: 0, failed: 0, total: 0 };
  }

  isSyncing = true;
  await emitSyncStatus();

  const pending = await getPendingOperations();
  const total = pending.length;

  if (total === 0) {
    console.log('No pending operations to sync');
    isSyncing = false;
    lastSyncAt = Date.now();
    lastSyncResult = 'success';
    await emitSyncStatus();
    return { success: true, synced: 0, failed: 0, total: 0 };
  }

  console.log(`Starting sync of ${total} pending operations`);

  let synced = 0;
  let failed = 0;

  // Process operations sequentially to avoid race conditions
  for (const item of pending) {
    const success = await syncOperation(item);
    if (success) {
      synced++;
    } else {
      failed++;
    }
  }

  // Cleanup old synced operations
  await clearOldSyncedOperations();

  // Determine result
  if (failed === 0) {
    lastSyncResult = 'success';
  } else if (synced > 0) {
    lastSyncResult = 'partial';
  } else {
    lastSyncResult = 'failed';
  }

  lastSyncAt = Date.now();
  isSyncing = false;

  console.log(`Sync complete: ${synced} synced, ${failed} failed out of ${total}`);

  // Refresh attendee list after sync
  if (synced > 0) {
    emitRefreshAttendees({ silent: true });
  }

  await emitSyncStatus();

  return {
    success: failed === 0,
    synced,
    failed,
    total,
  };
}

/**
 * Handle network state change
 */
async function handleNetworkChange(isConnected: boolean): Promise<void> {
  if (wasOffline && isConnected) {
    console.log('Network reconnected, triggering sync');
    // Small delay to ensure connection is stable
    setTimeout(async () => {
      const result = await syncAllPending();
      if (result.synced > 0) {
        console.log(`Auto-synced ${result.synced} check-ins on reconnect`);
      }
    }, 1000);
  }

  wasOffline = !isConnected;
}

/**
 * Initialize the sync manager with network monitoring
 */
export async function initSyncManager(): Promise<() => void> {
  // Check initial network state
  const networkState = await Network.getNetworkStateAsync();
  wasOffline = !networkState.isConnected || !networkState.isInternetReachable;

  // If we're online, try to sync any pending operations from previous session
  if (!wasOffline) {
    const stats = await getQueueStats();
    if (stats.pending > 0) {
      console.log(`Found ${stats.pending} pending operations from previous session, syncing...`);
      syncAllPending();
    }
  }

  // Set up network state polling (expo-network doesn't have a real-time listener)
  // Poll every 5 seconds for network changes
  let lastConnected = !wasOffline;
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
  }, 5000);

  // Return cleanup function
  return () => {
    clearInterval(pollInterval);
    if (networkSubscription) {
      networkSubscription();
      networkSubscription = null;
    }
  };
}

/**
 * Get current sync status
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const stats = await getQueueStats();

  return {
    isSyncing,
    lastSyncAt,
    lastSyncResult,
    pendingCount: stats.pending,
    syncedCount: stats.synced,
    failedCount: stats.failed,
  };
}

/**
 * Force a sync (user-initiated)
 */
export async function forceSync(): Promise<{
  success: boolean;
  synced: number;
  failed: number;
  message: string;
}> {
  const result = await syncAllPending();

  let message: string;
  if (result.total === 0) {
    message = 'No pending check-ins to sync';
  } else if (result.failed === 0) {
    message = `Successfully synced ${result.synced} check-in${result.synced === 1 ? '' : 's'}`;
  } else if (result.synced > 0) {
    message = `Synced ${result.synced} check-in${result.synced === 1 ? '' : 's'}, ${result.failed} failed`;
  } else {
    message = `Failed to sync ${result.failed} check-in${result.failed === 1 ? '' : 's'}`;
  }

  return {
    success: result.success,
    synced: result.synced,
    failed: result.failed,
    message,
  };
}
