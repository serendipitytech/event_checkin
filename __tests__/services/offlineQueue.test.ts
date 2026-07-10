/**
 * Unit tests for services/offlineQueue.ts
 * Tests offline queue operations, mutex serialization, and queue management
 */
import { clearAsyncStorageMock } from '../setup';

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('services/offlineQueue', () => {
  let offlineQueue: typeof import('../../services/offlineQueue');

  beforeEach(() => {
    clearAsyncStorageMock();
    jest.clearAllMocks();
    jest.resetModules();
    jest.restoreAllMocks();
    offlineQueue = require('../../services/offlineQueue');
  });

  describe('queueCheckIn', () => {
    it('queues a check-in and returns success with queueId', async () => {
      const result = await offlineQueue.queueCheckIn('att-1', 'evt-1', true);

      expect(result.success).toBe(true);
      expect(result.queueId).toBeDefined();
      expect(typeof result.queueId).toBe('string');

      const ops = await offlineQueue.getQueuedOperations();
      expect(ops).toHaveLength(1);
      expect(ops[0].attendeeId).toBe('att-1');
      expect(ops[0].eventId).toBe('evt-1');
      expect(ops[0].checkedIn).toBe(true);
      expect(ops[0].synced).toBe(false);
      expect(ops[0].attempts).toBe(0);
      expect(ops[0].error).toBeNull();
    });

    it('replaces existing pending operation for same attendee+event', async () => {
      const first = await offlineQueue.queueCheckIn('att-1', 'evt-1', true);
      const second = await offlineQueue.queueCheckIn('att-1', 'evt-1', false);

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      expect(second.queueId).not.toBe(first.queueId);

      const ops = await offlineQueue.getQueuedOperations();
      expect(ops).toHaveLength(1);
      expect(ops[0].checkedIn).toBe(false);
      expect(ops[0].id).toBe(second.queueId);
    });

    it('returns error when queue is full (100 items for one event)', async () => {
      // Queue 100 items with unique attendeeIds for the same event
      for (let i = 0; i < 100; i++) {
        const result = await offlineQueue.queueCheckIn(`att-${i}`, 'evt-1', true);
        expect(result.success).toBe(true);
      }

      // The 101st should fail
      const overflow = await offlineQueue.queueCheckIn('att-overflow', 'evt-1', true);
      expect(overflow.success).toBe(false);
      expect(overflow.error).toContain('Queue limit reached');
      expect(overflow.error).toContain('100');
    });

    it('does not count synced items toward queue limit', async () => {
      // Queue 100 items then mark them all synced
      const queueIds: string[] = [];
      for (let i = 0; i < 100; i++) {
        const result = await offlineQueue.queueCheckIn(`att-${i}`, 'evt-1', true);
        queueIds.push(result.queueId!);
      }

      // Mark all as synced
      for (const queueId of queueIds) {
        await offlineQueue.markSynced(queueId);
      }

      // Now queueing another item should succeed because synced items are excluded
      const result = await offlineQueue.queueCheckIn('att-new', 'evt-1', true);
      expect(result.success).toBe(true);
    });
  });

  describe('getQueuedOperations', () => {
    it('returns all operations when no eventId filter', async () => {
      await offlineQueue.queueCheckIn('att-1', 'evt-1', true);
      await offlineQueue.queueCheckIn('att-2', 'evt-2', true);
      await offlineQueue.queueCheckIn('att-3', 'evt-3', false);

      const ops = await offlineQueue.getQueuedOperations();
      expect(ops).toHaveLength(3);
    });

    it('filters by eventId when provided', async () => {
      await offlineQueue.queueCheckIn('att-1', 'evt-1', true);
      await offlineQueue.queueCheckIn('att-2', 'evt-1', false);
      await offlineQueue.queueCheckIn('att-3', 'evt-2', true);

      const evt1Ops = await offlineQueue.getQueuedOperations('evt-1');
      expect(evt1Ops).toHaveLength(2);
      expect(evt1Ops.every((op) => op.eventId === 'evt-1')).toBe(true);

      const evt2Ops = await offlineQueue.getQueuedOperations('evt-2');
      expect(evt2Ops).toHaveLength(1);
      expect(evt2Ops[0].attendeeId).toBe('att-3');
    });
  });

  describe('getPendingOperations', () => {
    it('excludes synced items', async () => {
      const r1 = await offlineQueue.queueCheckIn('att-1', 'evt-1', true);
      await offlineQueue.queueCheckIn('att-2', 'evt-1', true);

      await offlineQueue.markSynced(r1.queueId!);

      const pending = await offlineQueue.getPendingOperations('evt-1');
      expect(pending).toHaveLength(1);
      expect(pending[0].attendeeId).toBe('att-2');
    });

    it('excludes items that have reached max retry attempts', async () => {
      const r1 = await offlineQueue.queueCheckIn('att-1', 'evt-1', true);
      await offlineQueue.queueCheckIn('att-2', 'evt-1', true);

      // Fail 3 times to hit MAX_RETRY_ATTEMPTS
      await offlineQueue.markFailed(r1.queueId!, 'error 1');
      await offlineQueue.markFailed(r1.queueId!, 'error 2');
      await offlineQueue.markFailed(r1.queueId!, 'error 3');

      const pending = await offlineQueue.getPendingOperations('evt-1');
      expect(pending).toHaveLength(1);
      expect(pending[0].attendeeId).toBe('att-2');
    });
  });

  describe('markSynced', () => {
    it('marks item as synced and clears error', async () => {
      const r1 = await offlineQueue.queueCheckIn('att-1', 'evt-1', true);

      // First fail it so it has an error
      await offlineQueue.markFailed(r1.queueId!, 'some error');

      // Then mark synced
      await offlineQueue.markSynced(r1.queueId!);

      const ops = await offlineQueue.getQueuedOperations();
      expect(ops[0].synced).toBe(true);
      expect(ops[0].error).toBeNull();
    });

    it('does nothing for non-existent queueId', async () => {
      await offlineQueue.queueCheckIn('att-1', 'evt-1', true);

      // Should not throw
      await offlineQueue.markSynced('non-existent-id');

      const ops = await offlineQueue.getQueuedOperations();
      expect(ops).toHaveLength(1);
      expect(ops[0].synced).toBe(false);
    });
  });

  describe('markFailed', () => {
    it('increments attempts and records error message', async () => {
      const r1 = await offlineQueue.queueCheckIn('att-1', 'evt-1', true);

      await offlineQueue.markFailed(r1.queueId!, 'network timeout');

      const ops = await offlineQueue.getQueuedOperations();
      expect(ops[0].attempts).toBe(1);
      expect(ops[0].error).toBe('network timeout');

      // Fail again
      await offlineQueue.markFailed(r1.queueId!, 'server error');

      const ops2 = await offlineQueue.getQueuedOperations();
      expect(ops2[0].attempts).toBe(2);
      expect(ops2[0].error).toBe('server error');
    });

    it('sets lastAttemptAt timestamp', async () => {
      const r1 = await offlineQueue.queueCheckIn('att-1', 'evt-1', true);

      const beforeFail = Date.now();
      await offlineQueue.markFailed(r1.queueId!, 'timeout');
      const afterFail = Date.now();

      const ops = await offlineQueue.getQueuedOperations();
      expect(ops[0].lastAttemptAt).toBeGreaterThanOrEqual(beforeFail);
      expect(ops[0].lastAttemptAt).toBeLessThanOrEqual(afterFail);
    });
  });

  describe('removeFromQueue', () => {
    it('removes item and returns true', async () => {
      const r1 = await offlineQueue.queueCheckIn('att-1', 'evt-1', true);

      const removed = await offlineQueue.removeFromQueue(r1.queueId!);
      expect(removed).toBe(true);

      const ops = await offlineQueue.getQueuedOperations();
      expect(ops).toHaveLength(0);
    });

    it('returns false for non-existent queueId', async () => {
      await offlineQueue.queueCheckIn('att-1', 'evt-1', true);

      const removed = await offlineQueue.removeFromQueue('non-existent-id');
      expect(removed).toBe(false);

      const ops = await offlineQueue.getQueuedOperations();
      expect(ops).toHaveLength(1);
    });

    it('uses immutable removal (other items unchanged)', async () => {
      const r1 = await offlineQueue.queueCheckIn('att-1', 'evt-1', true);
      const r2 = await offlineQueue.queueCheckIn('att-2', 'evt-1', false);
      const r3 = await offlineQueue.queueCheckIn('att-3', 'evt-1', true);

      // Remove the middle item
      const removed = await offlineQueue.removeFromQueue(r2.queueId!);
      expect(removed).toBe(true);

      const ops = await offlineQueue.getQueuedOperations();
      expect(ops).toHaveLength(2);

      // First and third items should be intact
      expect(ops[0].id).toBe(r1.queueId);
      expect(ops[0].attendeeId).toBe('att-1');
      expect(ops[0].checkedIn).toBe(true);

      expect(ops[1].id).toBe(r3.queueId);
      expect(ops[1].attendeeId).toBe('att-3');
      expect(ops[1].checkedIn).toBe(true);
    });
  });

  describe('clearSyncedOperations', () => {
    it('removes synced items and returns count', async () => {
      const r1 = await offlineQueue.queueCheckIn('att-1', 'evt-1', true);
      const r2 = await offlineQueue.queueCheckIn('att-2', 'evt-1', true);
      await offlineQueue.queueCheckIn('att-3', 'evt-1', true);

      await offlineQueue.markSynced(r1.queueId!);
      await offlineQueue.markSynced(r2.queueId!);

      const cleared = await offlineQueue.clearSyncedOperations();
      expect(cleared).toBe(2);

      const ops = await offlineQueue.getQueuedOperations();
      expect(ops).toHaveLength(1);
    });

    it('preserves unsynced items', async () => {
      const r1 = await offlineQueue.queueCheckIn('att-1', 'evt-1', true);
      await offlineQueue.queueCheckIn('att-2', 'evt-1', false);
      await offlineQueue.queueCheckIn('att-3', 'evt-1', true);

      await offlineQueue.markSynced(r1.queueId!);

      await offlineQueue.clearSyncedOperations();

      const ops = await offlineQueue.getQueuedOperations();
      expect(ops).toHaveLength(2);
      expect(ops[0].attendeeId).toBe('att-2');
      expect(ops[1].attendeeId).toBe('att-3');
      expect(ops.every((op) => !op.synced)).toBe(true);
    });
  });

  describe('clearOldSyncedOperations', () => {
    it('removes synced items older than 24 hours', async () => {
      const NOW = 1700000000000;
      const TWENTY_FIVE_HOURS_MS = 25 * 60 * 60 * 1000;

      // Mock Date.now for queueing time
      jest.spyOn(Date, 'now').mockReturnValue(NOW - TWENTY_FIVE_HOURS_MS);

      const r1 = await offlineQueue.queueCheckIn('att-old', 'evt-1', true);
      await offlineQueue.markSynced(r1.queueId!);

      // Advance clock to "now"
      (Date.now as jest.Mock).mockReturnValue(NOW);

      const cleared = await offlineQueue.clearOldSyncedOperations();
      expect(cleared).toBe(1);

      const ops = await offlineQueue.getQueuedOperations();
      expect(ops).toHaveLength(0);
    });

    it('preserves recent synced items', async () => {
      const NOW = 1700000000000;
      const ONE_HOUR_MS = 1 * 60 * 60 * 1000;

      // Queue item 1 hour ago
      jest.spyOn(Date, 'now').mockReturnValue(NOW - ONE_HOUR_MS);

      const r1 = await offlineQueue.queueCheckIn('att-recent', 'evt-1', true);
      await offlineQueue.markSynced(r1.queueId!);

      // Advance clock to "now"
      (Date.now as jest.Mock).mockReturnValue(NOW);

      const cleared = await offlineQueue.clearOldSyncedOperations();
      expect(cleared).toBe(0);

      const ops = await offlineQueue.getQueuedOperations();
      expect(ops).toHaveLength(1);
    });

    it('preserves all unsynced items regardless of age', async () => {
      const NOW = 1700000000000;
      const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

      // Queue item 48 hours ago but don't sync it
      jest.spyOn(Date, 'now').mockReturnValue(NOW - FORTY_EIGHT_HOURS_MS);

      await offlineQueue.queueCheckIn('att-old-unsynced', 'evt-1', true);

      // Advance clock to "now"
      (Date.now as jest.Mock).mockReturnValue(NOW);

      const cleared = await offlineQueue.clearOldSyncedOperations();
      expect(cleared).toBe(0);

      const ops = await offlineQueue.getQueuedOperations();
      expect(ops).toHaveLength(1);
      expect(ops[0].attendeeId).toBe('att-old-unsynced');
    });
  });

  describe('getQueueStats', () => {
    it('returns correct counts for pending, failed, synced, total', async () => {
      // 1 pending
      await offlineQueue.queueCheckIn('att-pending', 'evt-1', true);

      // 1 failed (3 attempts)
      const rFailed = await offlineQueue.queueCheckIn('att-failed', 'evt-1', true);
      await offlineQueue.markFailed(rFailed.queueId!, 'err 1');
      await offlineQueue.markFailed(rFailed.queueId!, 'err 2');
      await offlineQueue.markFailed(rFailed.queueId!, 'err 3');

      // 1 synced
      const rSynced = await offlineQueue.queueCheckIn('att-synced', 'evt-1', true);
      await offlineQueue.markSynced(rSynced.queueId!);

      const stats = await offlineQueue.getQueueStats('evt-1');

      expect(stats.pending).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.synced).toBe(1);
      expect(stats.total).toBe(3);
    });

    it('calculates oldestQueuedAt from pending items', async () => {
      const NOW = 1700000000000;

      jest.spyOn(Date, 'now').mockReturnValue(NOW - 5000);
      await offlineQueue.queueCheckIn('att-older', 'evt-1', true);

      (Date.now as jest.Mock).mockReturnValue(NOW - 1000);
      await offlineQueue.queueCheckIn('att-newer', 'evt-1', true);

      // Mark synced item to verify it's excluded from oldest calculation
      (Date.now as jest.Mock).mockReturnValue(NOW - 10000);
      const rSynced = await offlineQueue.queueCheckIn('att-synced', 'evt-1', true);
      await offlineQueue.markSynced(rSynced.queueId!);

      (Date.now as jest.Mock).mockReturnValue(NOW);

      const stats = await offlineQueue.getQueueStats('evt-1');

      // oldestQueuedAt should come from unsynced items,
      // the oldest unsynced was queued at NOW - 5000
      expect(stats.oldestQueuedAt).toBe(NOW - 5000);
    });
  });

  describe('hasPendingCheckIn', () => {
    it('returns pending:true with checkedIn state when pending', async () => {
      await offlineQueue.queueCheckIn('att-1', 'evt-1', true);

      const result = await offlineQueue.hasPendingCheckIn('att-1', 'evt-1');
      expect(result.pending).toBe(true);
      expect(result.checkedIn).toBe(true);
    });

    it('returns pending:false when no pending for attendee', async () => {
      const result = await offlineQueue.hasPendingCheckIn('att-1', 'evt-1');
      expect(result.pending).toBe(false);
      expect(result.checkedIn).toBeUndefined();
    });

    it('returns pending:false when item is synced', async () => {
      const r1 = await offlineQueue.queueCheckIn('att-1', 'evt-1', true);
      await offlineQueue.markSynced(r1.queueId!);

      const result = await offlineQueue.hasPendingCheckIn('att-1', 'evt-1');
      expect(result.pending).toBe(false);
    });
  });

  describe('mutex serialization', () => {
    it('serializes concurrent queue operations', async () => {
      // Fire 3 queueCheckIn calls concurrently
      const results = await Promise.all([
        offlineQueue.queueCheckIn('att-a', 'evt-1', true),
        offlineQueue.queueCheckIn('att-b', 'evt-1', true),
        offlineQueue.queueCheckIn('att-c', 'evt-1', true),
      ]);

      // All should succeed
      expect(results.every((r) => r.success)).toBe(true);

      // All 3 unique queueIds
      const ids = results.map((r) => r.queueId);
      expect(new Set(ids).size).toBe(3);

      // All 3 items should be in the queue (no lost writes)
      const ops = await offlineQueue.getQueuedOperations();
      expect(ops).toHaveLength(3);
    });
  });

  describe('clearQueue', () => {
    it('removes entire queue from storage', async () => {
      await offlineQueue.queueCheckIn('att-1', 'evt-1', true);
      await offlineQueue.queueCheckIn('att-2', 'evt-2', false);

      await offlineQueue.clearQueue();

      const ops = await offlineQueue.getQueuedOperations();
      expect(ops).toHaveLength(0);
    });
  });
});
