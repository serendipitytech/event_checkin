/**
 * Lintnotes
 * - Purpose: Queue check-in operations when offline for later sync.
 * - Exports: queueCheckIn, getQueuedOperations, markSynced, clearSyncedOperations, getQueueStats
 * - Major deps: AsyncStorage for persistence
 * - Side effects: Reads/writes to AsyncStorage queue.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

const QUEUE_STORAGE_KEY = '@checkin_offline_queue';
const MAX_QUEUE_SIZE = 100; // Max items per event to prevent bloat
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Promise-based mutex to serialize all queue write operations.
 * Prevents race conditions when multiple callers attempt
 * concurrent loadQueue/saveQueue cycles.
 */
let queueMutex: Promise<void> = Promise.resolve();

function withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = queueMutex.then(fn, fn);
  queueMutex = result.then(() => {}, () => {});
  return result;
}

export type QueuedCheckIn = {
  id: string;
  attendeeId: string;
  eventId: string;
  checkedIn: boolean;
  queuedAt: number;
  attempts: number;
  lastAttemptAt: number | null;
  synced: boolean;
  error: string | null;
};

export type QueueStats = {
  pending: number;
  failed: number;
  synced: number;
  total: number;
  oldestQueuedAt: number | null;
};

/**
 * Generate a unique ID for queue items
 */
function generateQueueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Load the queue from AsyncStorage
 */
async function loadQueue(): Promise<QueuedCheckIn[]> {
  try {
    const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as QueuedCheckIn[];
  } catch (error) {
    logger.error('Failed to load offline queue:', error);
    return [];
  }
}

/**
 * Save the queue to AsyncStorage
 */
async function saveQueue(queue: QueuedCheckIn[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    logger.error('Failed to save offline queue:', error);
  }
}

/**
 * Queue a check-in operation for later sync
 */
export function queueCheckIn(
  attendeeId: string,
  eventId: string,
  checkedIn: boolean
): Promise<{ success: boolean; queueId?: string; error?: string }> {
  return withQueueLock(async () => {
    try {
      const queue = await loadQueue();

      // Check queue size limit for this event
      const eventQueueSize = queue.filter(
        (item) => item.eventId === eventId && !item.synced
      ).length;

      if (eventQueueSize >= MAX_QUEUE_SIZE) {
        return {
          success: false,
          error: `Queue limit reached (${MAX_QUEUE_SIZE} pending items). Please sync when online.`,
        };
      }

      // Check if there's already a pending operation for this attendee
      const existingIndex = queue.findIndex(
        (item) =>
          item.attendeeId === attendeeId &&
          item.eventId === eventId &&
          !item.synced
      );

      const queueId = generateQueueId();
      const newItem: QueuedCheckIn = {
        id: queueId,
        attendeeId,
        eventId,
        checkedIn,
        queuedAt: Date.now(),
        attempts: 0,
        lastAttemptAt: null,
        synced: false,
        error: null,
      };

      const updatedQueue = existingIndex >= 0
        ? // Replace existing pending operation (user changed their mind)
          queue.map((item, i) => i === existingIndex ? newItem : item)
        : [...queue, newItem];

      if (existingIndex >= 0) {
        logger.debug(`Replaced queued check-in for attendee ${attendeeId}`);
      } else {
        logger.debug(`Queued check-in for attendee ${attendeeId}`);
      }

      await saveQueue(updatedQueue);

      return { success: true, queueId };
    } catch (error) {
      logger.error('Failed to queue check-in:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to queue check-in',
      };
    }
  });
}

/**
 * Get all queued operations, optionally filtered by event
 */
export async function getQueuedOperations(
  eventId?: string
): Promise<QueuedCheckIn[]> {
  const queue = await loadQueue();

  if (eventId) {
    return queue.filter((item) => item.eventId === eventId);
  }

  return queue;
}

/**
 * Get only pending (not synced, not failed) operations
 */
export async function getPendingOperations(
  eventId?: string
): Promise<QueuedCheckIn[]> {
  const queue = await getQueuedOperations(eventId);
  return queue.filter(
    (item) => !item.synced && item.attempts < MAX_RETRY_ATTEMPTS
  );
}

/**
 * Mark an operation as synced
 */
export function markSynced(queueId: string): Promise<void> {
  return withQueueLock(async () => {
    const queue = await loadQueue();
    const index = queue.findIndex((item) => item.id === queueId);

    if (index >= 0) {
      const updatedQueue = queue.map((item, i) =>
        i === index ? { ...item, synced: true, error: null } : item
      );
      await saveQueue(updatedQueue);
      logger.debug(`Marked queue item ${queueId} as synced`);
    }
  });
}

/**
 * Mark an operation as failed with error
 */
export function markFailed(
  queueId: string,
  error: string
): Promise<void> {
  return withQueueLock(async () => {
    const queue = await loadQueue();
    const index = queue.findIndex((item) => item.id === queueId);

    if (index >= 0) {
      const updatedItem = {
        ...queue[index],
        attempts: queue[index].attempts + 1,
        lastAttemptAt: Date.now(),
        error,
      };
      const updatedQueue = queue.map((item, i) =>
        i === index ? updatedItem : item
      );
      await saveQueue(updatedQueue);
      logger.debug(`Marked queue item ${queueId} as failed (attempt ${updatedItem.attempts})`);
    }
  });
}

/**
 * Clear all synced operations (cleanup)
 */
export function clearSyncedOperations(): Promise<number> {
  return withQueueLock(async () => {
    const queue = await loadQueue();
    const before = queue.length;
    const filtered = queue.filter((item) => !item.synced);
    await saveQueue(filtered);
    const cleared = before - filtered.length;
    logger.debug(`Cleared ${cleared} synced operations from queue`);
    return cleared;
  });
}

/**
 * Clear old synced operations (older than 24 hours)
 */
export function clearOldSyncedOperations(): Promise<number> {
  return withQueueLock(async () => {
    const queue = await loadQueue();
    const before = queue.length;
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    const filtered = queue.filter(
      (item) => !item.synced || item.queuedAt > oneDayAgo
    );

    await saveQueue(filtered);
    const cleared = before - filtered.length;

    if (cleared > 0) {
      logger.debug(`Cleared ${cleared} old synced operations from queue`);
    }

    return cleared;
  });
}

/**
 * Get queue statistics
 */
export async function getQueueStats(eventId?: string): Promise<QueueStats> {
  const queue = await getQueuedOperations(eventId);

  const pending = queue.filter(
    (item) => !item.synced && item.attempts < MAX_RETRY_ATTEMPTS
  ).length;

  const failed = queue.filter(
    (item) => !item.synced && item.attempts >= MAX_RETRY_ATTEMPTS
  ).length;

  const synced = queue.filter((item) => item.synced).length;

  const pendingItems = queue.filter((item) => !item.synced);
  const oldestQueuedAt =
    pendingItems.length > 0
      ? Math.min(...pendingItems.map((item) => item.queuedAt))
      : null;

  return {
    pending,
    failed,
    synced,
    total: queue.length,
    oldestQueuedAt,
  };
}

/**
 * Check if an attendee has a pending (unsynced) check-in in the queue
 */
export async function hasPendingCheckIn(
  attendeeId: string,
  eventId: string
): Promise<{ pending: boolean; checkedIn?: boolean }> {
  const queue = await loadQueue();
  const pendingItem = queue.find(
    (item) =>
      item.attendeeId === attendeeId &&
      item.eventId === eventId &&
      !item.synced &&
      item.attempts < MAX_RETRY_ATTEMPTS
  );

  if (pendingItem) {
    return { pending: true, checkedIn: pendingItem.checkedIn };
  }

  return { pending: false };
}

/**
 * Remove a specific item from the queue (e.g., user cancels)
 */
export function removeFromQueue(queueId: string): Promise<boolean> {
  return withQueueLock(async () => {
    const queue = await loadQueue();
    const index = queue.findIndex((item) => item.id === queueId);

    if (index >= 0) {
      const updatedQueue = queue.filter((_, i) => i !== index);
      await saveQueue(updatedQueue);
      logger.debug(`Removed queue item ${queueId}`);
      return true;
    }

    return false;
  });
}

/**
 * Clear entire queue (use with caution)
 */
export function clearQueue(): Promise<void> {
  return withQueueLock(async () => {
    await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
    logger.debug('Cleared entire offline queue');
  });
}
