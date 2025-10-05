/**
 * Lintnotes
 * - Purpose: Lightweight in-memory event bus for attendee list refreshes and auto-refresh interval sharing.
 * - Exports: RefreshOptions/RefreshListener (types), addRefreshListener, emitRefreshAttendees,
 *            addAutoRefreshListener, setAutoRefreshInterval, getAutoRefreshInterval.
 * - Major deps: None (module-level sets/timers only).
 * - Side effects: Stores listeners and a shared interval value in module scope.
 */
export type RefreshOptions = {
  silent?: boolean;
};

export type RefreshListener = (options?: RefreshOptions) => void;

const refreshListeners = new Set<RefreshListener>();

export const addRefreshListener = (listener: RefreshListener): (() => void) => {
  refreshListeners.add(listener);
  return () => {
    refreshListeners.delete(listener);
  };
};

export const emitRefreshAttendees = (options?: RefreshOptions): void => {
  refreshListeners.forEach((listener) => listener(options));
};

type AutoRefreshListener = (interval: number) => void;

const autoRefreshListeners = new Set<AutoRefreshListener>();

let currentAutoRefreshInterval = 5000;

export const addAutoRefreshListener = (
  listener: AutoRefreshListener
): (() => void) => {
  autoRefreshListeners.add(listener);
  listener(currentAutoRefreshInterval);
  return () => {
    autoRefreshListeners.delete(listener);
  };
};

export const setAutoRefreshInterval = (interval: number): void => {
  currentAutoRefreshInterval = interval;
  autoRefreshListeners.forEach((listener) => listener(interval));
};

export const getAutoRefreshInterval = (): number => currentAutoRefreshInterval;
