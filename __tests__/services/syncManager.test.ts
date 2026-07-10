/**
 * Unit tests for services/syncManager.ts
 * Tests sync orchestration, retry logic, network awareness, and listener system.
 */

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock expo-network
jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(),
}));

// Mock supabase client
jest.mock('../../services/supabase', () => ({
  getSupabaseClient: jest.fn(),
}));

// Mock offlineQueue
jest.mock('../../services/offlineQueue', () => ({
  getPendingOperations: jest.fn(),
  markSynced: jest.fn(),
  markFailed: jest.fn(),
  clearOldSyncedOperations: jest.fn(),
  getQueueStats: jest.fn(),
}));

// Mock attendeeEvents
jest.mock('../../services/attendeeEvents', () => ({
  emitRefreshAttendees: jest.fn(),
}));

describe('services/syncManager', () => {
  // Get fresh module for each test to reset module state
  let syncManager: typeof import('../../services/syncManager');
  let mockNetwork: { getNetworkStateAsync: jest.Mock };
  let mockOfflineQueue: {
    getPendingOperations: jest.Mock;
    markSynced: jest.Mock;
    markFailed: jest.Mock;
    clearOldSyncedOperations: jest.Mock;
    getQueueStats: jest.Mock;
  };
  let mockSupabase: { getSupabaseClient: jest.Mock };
  let mockAttendeeEvents: { emitRefreshAttendees: jest.Mock };

  const mockRpc = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.useFakeTimers();

    // Set up mocks before requiring the module
    mockNetwork = require('expo-network');
    mockOfflineQueue = require('../../services/offlineQueue');
    mockSupabase = require('../../services/supabase');
    mockAttendeeEvents = require('../../services/attendeeEvents');

    // Default: online
    mockNetwork.getNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });

    // Default: empty queue stats
    mockOfflineQueue.getQueueStats.mockResolvedValue({
      pending: 0,
      failed: 0,
      synced: 0,
      total: 0,
    });
    mockOfflineQueue.getPendingOperations.mockResolvedValue([]);
    mockOfflineQueue.markSynced.mockResolvedValue(undefined);
    mockOfflineQueue.markFailed.mockResolvedValue(undefined);
    mockOfflineQueue.clearOldSyncedOperations.mockResolvedValue(0);

    // Default: supabase client with rpc
    mockRpc.mockResolvedValue({ error: null });
    mockSupabase.getSupabaseClient.mockReturnValue({ rpc: mockRpc });

    syncManager = require('../../services/syncManager');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('syncAllPending', () => {
    it('returns early with success:false when already syncing', async () => {
      // Make first sync hang by having a pending operation that never resolves
      mockOfflineQueue.getPendingOperations.mockResolvedValue([
        {
          id: 'q1',
          attendeeId: 'a1',
          checkedIn: true,
          eventId: 'e1',
          queuedAt: Date.now(),
          attempts: 0,
          lastAttemptAt: null,
          synced: false,
          error: null,
        },
      ]);
      mockRpc.mockReturnValue(new Promise(() => {})); // never resolves

      const firstSync = syncManager.syncAllPending();
      // Allow the first sync to get past the isSyncing guard and network check
      await jest.advanceTimersByTimeAsync(0);

      // Start second sync while first is in progress
      const secondResult = await syncManager.syncAllPending();

      expect(secondResult).toEqual({
        success: false,
        synced: 0,
        failed: 0,
        total: 0,
      });
    });

    it('returns early when offline', async () => {
      mockNetwork.getNetworkStateAsync.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });

      const result = await syncManager.syncAllPending();

      expect(result).toEqual({
        success: false,
        synced: 0,
        failed: 0,
        total: 0,
      });
    });

    it('returns success when queue is empty', async () => {
      const result = await syncManager.syncAllPending();

      expect(result).toEqual({
        success: true,
        synced: 0,
        failed: 0,
        total: 0,
      });
    });

    it('syncs pending operations and returns counts', async () => {
      mockOfflineQueue.getPendingOperations.mockResolvedValue([
        {
          id: 'q1',
          attendeeId: 'a1',
          checkedIn: true,
          eventId: 'e1',
          queuedAt: Date.now(),
          attempts: 0,
          lastAttemptAt: null,
          synced: false,
          error: null,
        },
        {
          id: 'q2',
          attendeeId: 'a2',
          checkedIn: false,
          eventId: 'e1',
          queuedAt: Date.now(),
          attempts: 0,
          lastAttemptAt: null,
          synced: false,
          error: null,
        },
      ]);

      const result = await syncManager.syncAllPending();

      expect(result).toEqual({
        success: true,
        synced: 2,
        failed: 0,
        total: 2,
      });
      expect(mockOfflineQueue.markSynced).toHaveBeenCalledTimes(2);
      expect(mockOfflineQueue.markSynced).toHaveBeenCalledWith('q1');
      expect(mockOfflineQueue.markSynced).toHaveBeenCalledWith('q2');
    });

    it('calls supabase rpc with correct parameters', async () => {
      mockOfflineQueue.getPendingOperations.mockResolvedValue([
        {
          id: 'q1',
          attendeeId: 'att-123',
          checkedIn: true,
          eventId: 'e1',
          queuedAt: Date.now(),
          attempts: 0,
          lastAttemptAt: null,
          synced: false,
          error: null,
        },
      ]);

      await syncManager.syncAllPending();

      expect(mockRpc).toHaveBeenCalledWith('toggle_checkin', {
        p_attendee_id: 'att-123',
        p_checked: true,
      });
    });

    it('handles partial failures with non-retryable errors', async () => {
      mockOfflineQueue.getPendingOperations.mockResolvedValue([
        {
          id: 'q1',
          attendeeId: 'a1',
          checkedIn: true,
          eventId: 'e1',
          queuedAt: Date.now(),
          attempts: 0,
          lastAttemptAt: null,
          synced: false,
          error: null,
        },
        {
          id: 'q2',
          attendeeId: 'a2',
          checkedIn: false,
          eventId: 'e1',
          queuedAt: Date.now(),
          attempts: 0,
          lastAttemptAt: null,
          synced: false,
          error: null,
        },
      ]);

      // First succeeds, second fails with non-retryable JWT error (thrown as Error instance)
      mockRpc
        .mockResolvedValueOnce({ error: null })
        .mockRejectedValueOnce(new Error('JWT expired'));

      const result = await syncManager.syncAllPending();

      expect(result.success).toBe(false);
      expect(result.synced).toBe(1);
      expect(result.failed).toBe(1);
      expect(mockOfflineQueue.markSynced).toHaveBeenCalledWith('q1');
      expect(mockOfflineQueue.markFailed).toHaveBeenCalledWith('q2', 'JWT expired');
    });

    it('handles conflict errors by accepting server state', async () => {
      mockOfflineQueue.getPendingOperations.mockResolvedValue([
        {
          id: 'q1',
          attendeeId: 'a1',
          checkedIn: true,
          eventId: 'e1',
          queuedAt: Date.now(),
          attempts: 0,
          lastAttemptAt: null,
          synced: false,
          error: null,
        },
      ]);

      mockRpc.mockResolvedValueOnce({
        error: { message: 'Attendee already checked in' },
      });

      const result = await syncManager.syncAllPending();

      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);
      expect(mockOfflineQueue.markSynced).toHaveBeenCalledWith('q1');
    });

    it('emits refresh when items are synced', async () => {
      mockOfflineQueue.getPendingOperations.mockResolvedValue([
        {
          id: 'q1',
          attendeeId: 'a1',
          checkedIn: true,
          eventId: 'e1',
          queuedAt: Date.now(),
          attempts: 0,
          lastAttemptAt: null,
          synced: false,
          error: null,
        },
      ]);

      await syncManager.syncAllPending();

      expect(mockAttendeeEvents.emitRefreshAttendees).toHaveBeenCalledWith({
        silent: true,
      });
    });

    it('does not emit refresh when no items are synced', async () => {
      // Empty queue
      const result = await syncManager.syncAllPending();

      expect(result.success).toBe(true);
      expect(mockAttendeeEvents.emitRefreshAttendees).not.toHaveBeenCalled();
    });

    it('calls clearOldSyncedOperations after syncing', async () => {
      mockOfflineQueue.getPendingOperations.mockResolvedValue([
        {
          id: 'q1',
          attendeeId: 'a1',
          checkedIn: true,
          eventId: 'e1',
          queuedAt: Date.now(),
          attempts: 0,
          lastAttemptAt: null,
          synced: false,
          error: null,
        },
      ]);

      await syncManager.syncAllPending();

      expect(mockOfflineQueue.clearOldSyncedOperations).toHaveBeenCalled();
    });

    it('sets lastSyncResult to "partial" when some succeed and some fail', async () => {
      mockOfflineQueue.getPendingOperations.mockResolvedValue([
        {
          id: 'q1',
          attendeeId: 'a1',
          checkedIn: true,
          eventId: 'e1',
          queuedAt: Date.now(),
          attempts: 0,
          lastAttemptAt: null,
          synced: false,
          error: null,
        },
        {
          id: 'q2',
          attendeeId: 'a2',
          checkedIn: false,
          eventId: 'e1',
          queuedAt: Date.now(),
          attempts: 0,
          lastAttemptAt: null,
          synced: false,
          error: null,
        },
      ]);

      mockRpc
        .mockResolvedValueOnce({ error: null })
        .mockRejectedValueOnce(new Error('unauthorized'));

      await syncManager.syncAllPending();

      const status = await syncManager.getSyncStatus();
      expect(status.lastSyncResult).toBe('partial');
    });

    it('sets lastSyncResult to "failed" when all operations fail', async () => {
      mockOfflineQueue.getPendingOperations.mockResolvedValue([
        {
          id: 'q1',
          attendeeId: 'a1',
          checkedIn: true,
          eventId: 'e1',
          queuedAt: Date.now(),
          attempts: 0,
          lastAttemptAt: null,
          synced: false,
          error: null,
        },
      ]);

      mockRpc.mockRejectedValueOnce(new Error('JWT expired'));

      await syncManager.syncAllPending();

      const status = await syncManager.getSyncStatus();
      expect(status.lastSyncResult).toBe('failed');
    });

    it('retries transient errors with exponential backoff', async () => {
      mockOfflineQueue.getPendingOperations.mockResolvedValue([
        {
          id: 'q1',
          attendeeId: 'a1',
          checkedIn: true,
          eventId: 'e1',
          queuedAt: Date.now(),
          attempts: 0,
          lastAttemptAt: null,
          synced: false,
          error: null,
        },
      ]);

      // Fail twice with transient error (thrown as Error), then succeed
      mockRpc
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValueOnce({ error: null });

      const syncPromise = syncManager.syncAllPending();

      // First retry delay: 1000ms
      await jest.advanceTimersByTimeAsync(1000);
      // Second retry delay: 2000ms
      await jest.advanceTimersByTimeAsync(2000);

      const result = await syncPromise;

      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);
      expect(mockRpc).toHaveBeenCalledTimes(3);
    });

    it('fails after max retries for transient errors', async () => {
      mockOfflineQueue.getPendingOperations.mockResolvedValue([
        {
          id: 'q1',
          attendeeId: 'a1',
          checkedIn: true,
          eventId: 'e1',
          queuedAt: Date.now(),
          attempts: 0,
          lastAttemptAt: null,
          synced: false,
          error: null,
        },
      ]);

      // Fail all attempts with transient error (use Error objects so instanceof check works)
      const transientError = new Error('network timeout');
      mockRpc.mockRejectedValue(transientError);

      const syncPromise = syncManager.syncAllPending();

      // Advance through all retry delays: 1000 + 2000 + 5000
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);
      await jest.advanceTimersByTimeAsync(5000);

      const result = await syncPromise;

      expect(result.success).toBe(false);
      expect(result.failed).toBe(1);
      // Initial attempt + 3 retries = 4 calls
      expect(mockRpc).toHaveBeenCalledTimes(4);
      expect(mockOfflineQueue.markFailed).toHaveBeenCalledWith('q1', 'network timeout');
    });
  });

  describe('getSyncStatus', () => {
    it('returns initial sync status', async () => {
      const status = await syncManager.getSyncStatus();

      expect(status).toEqual({
        isSyncing: false,
        lastSyncAt: null,
        lastSyncResult: null,
        pendingCount: 0,
        syncedCount: 0,
        failedCount: 0,
      });
    });

    it('reflects queue stats from offlineQueue', async () => {
      mockOfflineQueue.getQueueStats.mockResolvedValue({
        pending: 3,
        failed: 1,
        synced: 5,
        total: 9,
      });

      const status = await syncManager.getSyncStatus();

      expect(status.pendingCount).toBe(3);
      expect(status.failedCount).toBe(1);
      expect(status.syncedCount).toBe(5);
    });

    it('updates lastSyncAt after a sync', async () => {
      const beforeSync = Date.now();
      await syncManager.syncAllPending();
      const status = await syncManager.getSyncStatus();

      expect(status.lastSyncAt).toBeGreaterThanOrEqual(beforeSync);
      expect(status.lastSyncResult).toBe('success');
    });
  });

  describe('forceSync', () => {
    it('returns message for empty queue', async () => {
      const result = await syncManager.forceSync();

      expect(result.message).toBe('No pending check-ins to sync');
    });

    it('returns success message after syncing single item', async () => {
      mockOfflineQueue.getPendingOperations.mockResolvedValue([
        {
          id: 'q1',
          attendeeId: 'a1',
          checkedIn: true,
          eventId: 'e1',
          queuedAt: Date.now(),
          attempts: 0,
          lastAttemptAt: null,
          synced: false,
          error: null,
        },
      ]);

      const result = await syncManager.forceSync();

      expect(result.message).toBe('Successfully synced 1 check-in');
      expect(result.success).toBe(true);
    });

    it('returns plural message after syncing multiple items', async () => {
      mockOfflineQueue.getPendingOperations.mockResolvedValue([
        {
          id: 'q1',
          attendeeId: 'a1',
          checkedIn: true,
          eventId: 'e1',
          queuedAt: Date.now(),
          attempts: 0,
          lastAttemptAt: null,
          synced: false,
          error: null,
        },
        {
          id: 'q2',
          attendeeId: 'a2',
          checkedIn: false,
          eventId: 'e1',
          queuedAt: Date.now(),
          attempts: 0,
          lastAttemptAt: null,
          synced: false,
          error: null,
        },
      ]);

      const result = await syncManager.forceSync();

      expect(result.message).toBe('Successfully synced 2 check-ins');
      expect(result.success).toBe(true);
      expect(result.synced).toBe(2);
    });

    it('returns partial failure message', async () => {
      mockOfflineQueue.getPendingOperations.mockResolvedValue([
        {
          id: 'q1',
          attendeeId: 'a1',
          checkedIn: true,
          eventId: 'e1',
          queuedAt: Date.now(),
          attempts: 0,
          lastAttemptAt: null,
          synced: false,
          error: null,
        },
        {
          id: 'q2',
          attendeeId: 'a2',
          checkedIn: false,
          eventId: 'e1',
          queuedAt: Date.now(),
          attempts: 0,
          lastAttemptAt: null,
          synced: false,
          error: null,
        },
      ]);

      // First succeeds, second fails with non-retryable error (thrown as Error instance)
      mockRpc
        .mockResolvedValueOnce({ error: null })
        .mockRejectedValueOnce(new Error('JWT expired'));

      const result = await syncManager.forceSync();

      expect(result.message).toBe('Synced 1 check-in, 1 failed');
      expect(result.success).toBe(false);
    });

    it('returns all-failed message', async () => {
      mockOfflineQueue.getPendingOperations.mockResolvedValue([
        {
          id: 'q1',
          attendeeId: 'a1',
          checkedIn: true,
          eventId: 'e1',
          queuedAt: Date.now(),
          attempts: 0,
          lastAttemptAt: null,
          synced: false,
          error: null,
        },
      ]);

      // Non-retryable error thrown as Error instance
      mockRpc.mockRejectedValueOnce(new Error('permission denied'));

      const result = await syncManager.forceSync();

      expect(result.message).toBe('Failed to sync 1 check-in');
      expect(result.success).toBe(false);
    });
  });

  describe('addSyncListener', () => {
    it('calls listener on sync status changes', async () => {
      const listener = jest.fn();
      syncManager.addSyncListener(listener);

      await syncManager.syncAllPending();

      expect(listener).toHaveBeenCalled();
    });

    it('passes SyncStatus object to listener', async () => {
      const listener = jest.fn();
      syncManager.addSyncListener(listener);

      await syncManager.syncAllPending();

      const lastCall = listener.mock.calls[listener.mock.calls.length - 1][0];
      expect(lastCall).toHaveProperty('isSyncing');
      expect(lastCall).toHaveProperty('lastSyncAt');
      expect(lastCall).toHaveProperty('lastSyncResult');
      expect(lastCall).toHaveProperty('pendingCount');
      expect(lastCall).toHaveProperty('syncedCount');
      expect(lastCall).toHaveProperty('failedCount');
    });

    it('returns unsubscribe function that stops notifications', async () => {
      const listener = jest.fn();
      const unsubscribe = syncManager.addSyncListener(listener);

      unsubscribe();
      listener.mockClear();

      await syncManager.syncAllPending();

      expect(listener).not.toHaveBeenCalled();
    });

    it('supports multiple listeners', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      syncManager.addSyncListener(listener1);
      syncManager.addSyncListener(listener2);

      await syncManager.syncAllPending();

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('handles listener errors gracefully', async () => {
      const badListener = jest.fn(() => {
        throw new Error('Listener exploded');
      });
      const goodListener = jest.fn();

      syncManager.addSyncListener(badListener);
      syncManager.addSyncListener(goodListener);

      // Should not throw despite bad listener
      await syncManager.syncAllPending();

      expect(goodListener).toHaveBeenCalled();
    });
  });

  describe('initSyncManager', () => {
    it('syncs pending operations on startup when online with pending items', async () => {
      mockOfflineQueue.getQueueStats.mockResolvedValue({
        pending: 1,
        failed: 0,
        synced: 0,
        total: 1,
      });
      mockOfflineQueue.getPendingOperations.mockResolvedValue([
        {
          id: 'q1',
          attendeeId: 'a1',
          checkedIn: true,
          eventId: 'e1',
          queuedAt: Date.now(),
          attempts: 0,
          lastAttemptAt: null,
          synced: false,
          error: null,
        },
      ]);

      const cleanup = await syncManager.initSyncManager();

      // The initial sync is fire-and-forget with .catch(), so flush promises
      await jest.advanceTimersByTimeAsync(0);

      expect(mockOfflineQueue.getPendingOperations).toHaveBeenCalled();

      cleanup();
    });

    it('does not sync on startup when offline', async () => {
      mockNetwork.getNetworkStateAsync.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });

      const cleanup = await syncManager.initSyncManager();
      await jest.advanceTimersByTimeAsync(0);

      // getPendingOperations should not be called since we're offline
      // (getQueueStats should also not be called)
      expect(mockOfflineQueue.getPendingOperations).not.toHaveBeenCalled();

      cleanup();
    });

    it('does not sync on startup when no pending items', async () => {
      mockOfflineQueue.getQueueStats.mockResolvedValue({
        pending: 0,
        failed: 0,
        synced: 0,
        total: 0,
      });

      const cleanup = await syncManager.initSyncManager();
      await jest.advanceTimersByTimeAsync(0);

      // getPendingOperations should not be called since queue is empty
      expect(mockOfflineQueue.getPendingOperations).not.toHaveBeenCalled();

      cleanup();
    });

    it('returns cleanup function that stops polling', async () => {
      const cleanup = await syncManager.initSyncManager();

      expect(typeof cleanup).toBe('function');

      // Reset call count after init
      mockNetwork.getNetworkStateAsync.mockClear();

      cleanup();

      // Advance past a poll interval — should not trigger new network checks
      await jest.advanceTimersByTimeAsync(10000);

      expect(mockNetwork.getNetworkStateAsync).not.toHaveBeenCalled();
    });

    it('polls network state at regular intervals', async () => {
      const cleanup = await syncManager.initSyncManager();

      // Reset after init setup calls
      mockNetwork.getNetworkStateAsync.mockClear();

      // Advance one poll interval (5000ms)
      await jest.advanceTimersByTimeAsync(5000);
      expect(mockNetwork.getNetworkStateAsync).toHaveBeenCalledTimes(1);

      // Advance another poll interval
      await jest.advanceTimersByTimeAsync(5000);
      expect(mockNetwork.getNetworkStateAsync).toHaveBeenCalledTimes(2);

      cleanup();
    });
  });
});
