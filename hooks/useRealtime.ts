import { useEffect, useState } from 'react';
import { 
  getAllRealtimeConnectionStatuses, 
  getRealtimeConnectionStatus,
  type RealtimeConnectionStatus 
} from '../services/realtime';

export const useRealtimeStatus = (channelName?: string) => {
  const [status, setStatus] = useState<RealtimeConnectionStatus | undefined>();
  const [allStatuses, setAllStatuses] = useState<Map<string, RealtimeConnectionStatus>>(new Map());

  useEffect(() => {
    const updateStatus = () => {
      if (channelName) {
        setStatus(getRealtimeConnectionStatus(channelName));
      }
      setAllStatuses(getAllRealtimeConnectionStatuses());
    };

    // Initial update
    updateStatus();

    // Update every 5 seconds to catch status changes
    const interval = setInterval(updateStatus, 5000);

    return () => clearInterval(interval);
  }, [channelName]);

  return {
    status,
    allStatuses,
    isConnected: status?.isConnected ?? false,
    lastError: status?.lastError,
    reconnectAttempts: status?.reconnectAttempts ?? 0,
    lastConnectedAt: status?.lastConnectedAt,
  };
};

export const useRealtimeConnection = () => {
  const { allStatuses, isConnected, lastError, reconnectAttempts } = useRealtimeStatus();

  const hasAnyConnection = Array.from(allStatuses.values()).some(s => s.isConnected);
  const hasErrors = Array.from(allStatuses.values()).some(s => s.lastError);
  const totalReconnectAttempts = Array.from(allStatuses.values())
    .reduce((sum, s) => sum + s.reconnectAttempts, 0);

  return {
    hasAnyConnection,
    hasErrors,
    totalReconnectAttempts,
    connectionCount: allStatuses.size,
    statuses: allStatuses,
  };
};
