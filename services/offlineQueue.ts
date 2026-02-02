/**
 * Lintnotes
 * - Purpose: Queue check-in operations when offline for later sync.
 * - Exports: queueCheckIn, getQueuedOperations, markSynced, clearSyncedOperations, getQueueStats
 * - Major deps: AsyncStorage for persistence
 * - Side effects: Reads/writes to AsyncStorage queue.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_STORAGE_KEY = '@checkin_offline_queue';
const MAX_QUEUE_SIZE = 100; // Max items per event to prevent bloat
const MAX_RETRY_ATTEMPTS = 3;

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
    console.error('Failed to load offline queue:', error);
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
    console.error('Failed to save offline queue:', error);
  }
}

/**
 * Queue a check-in operation for later sync
 */
export async function queueCheckIn(
  attendeeId: string,
  eventId: string,
  checkedIn: boolean
): Promise<{ success: boolean; queueId?: string; error?: string }> {
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

    if (existingIndex >= 0) {
      // Replace existing pending operation (user changed their mind)
      queue[existingIndex] = newItem;
      console.log(`Replaced queued check-in for attendee ${attendeeId}`);
    } else {
      queue.push(newItem);
      console.log(`Queued check-in for attendee ${attendeeId}`);
    }

    await saveQueue(queue);

    return { success: true, queueId };
  } catch (error) {
    console.error('Failed to queue check-in:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue check-in',
    };
  }
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
export async function markSynced(queueId: string): Promise<void> {
  const queue = await loadQueue();
  const index = queue.findIndex((item) => item.id === queueId);

  if (index >= 0) {
    queue[index] = {
      ...queue[index],
      synced: true,
      error: null,
    };
    await saveQueue(queue);
    console.log(`Marked queue item ${queueId} as synced`);
  }
}

/**
 * Mark an operation as failed with error
 */
export async function markFailed(
  queueId: string,
  error: string
): Promise<void> {
  const queue = await loadQueue();
  const index = queue.findIndex((item) => item.id === queueId);

  if (index >= 0) {
    queue[index] = {
      ...queue[index],
      attempts: queue[index].attempts + 1,
      lastAttemptAt: Date.now(),
      error,
    };
    await saveQueue(queue);
    console.log(`Marked queue item ${queueId} as failed (attempt ${queue[index].attempts})`);
  }
}

/**
 * Clear all synced operations (cleanup)
 */
export async function clearSyncedOperations(): Promise<number> {
  const queue = await loadQueue();
  const before = queue.length;
  const filtered = queue.filter((item) => !item.synced);
  await saveQueue(filtered);
  const cleared = before - filtered.length;
  console.log(`Cleared ${cleared} synced operations from queue`);
  return cleared;
}

/**
 * Clear old synced operations (older than 24 hours)
 */
export async function clearOldSyncedOperations(): Promise<number> {
  const queue = await loadQueue();
  const before = queue.length;
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  const filtered = queue.filter(
    (item) => !item.synced || item.queuedAt > oneDayAgo
  );

  await saveQueue(filtered);
  const cleared = before - filtered.length;

  if (cleared > 0) {
    console.log(`Cleared ${cleared} old synced operations from queue`);
  }

  return cleared;
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
export async function removeFromQueue(queueId: string): Promise<boolean> {
  const queue = await loadQueue();
  const index = queue.findIndex((item) => item.id === queueId);

  if (index >= 0) {
    queue.splice(index, 1);
    await saveQueue(queue);
    console.log(`Removed queue item ${queueId}`);
    return true;
  }

  return false;
}

/**
 * Clear entire queue (use with caution)
 */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
  console.log('Cleared entire offline queue');
}
