/**
 * Lintnotes
 * - Purpose: Visual indicator showing offline status and pending sync count.
 * - Exports: OfflineIndicator (React component), useOfflineStatus (hook)
 * - Major deps: expo-network, syncManager
 * - Side effects: Polls network state, subscribes to sync status.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import * as Network from 'expo-network';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  addSyncListener,
  getSyncStatus,
  forceSync,
  type SyncStatus,
} from '../services/syncManager';

type OfflineStatus = {
  isOffline: boolean;
  pendingCount: number;
  isSyncing: boolean;
};

/**
 * Hook to track offline status and pending operations
 */
export function useOfflineStatus(): OfflineStatus {
  const [isOffline, setIsOffline] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    // Check initial network state
    const checkNetwork = async () => {
      const state = await Network.getNetworkStateAsync();
      setIsOffline(!state.isConnected || !state.isInternetReachable);
    };

    checkNetwork();

    // Poll network state every 3 seconds
    const interval = setInterval(checkNetwork, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Get initial sync status
    getSyncStatus().then(setSyncStatus);

    // Subscribe to sync status changes
    const unsubscribe = addSyncListener(setSyncStatus);

    return unsubscribe;
  }, []);

  return {
    isOffline,
    pendingCount: syncStatus?.pendingCount ?? 0,
    isSyncing: syncStatus?.isSyncing ?? false,
  };
}

type OfflineIndicatorProps = {
  showWhenOnline?: boolean;
};

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  showWhenOnline = false,
}) => {
  const { isOffline, pendingCount, isSyncing } = useOfflineStatus();
  const [expanded, setExpanded] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const fadeAnim = useState(new Animated.Value(0))[0];

  // Animate in/out
  useEffect(() => {
    const shouldShow = isOffline || pendingCount > 0 || showWhenOnline;

    Animated.timing(fadeAnim, {
      toValue: shouldShow ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline, pendingCount, showWhenOnline, fadeAnim]);

  // Clear sync message after delay
  useEffect(() => {
    if (syncMessage) {
      const timer = setTimeout(() => setSyncMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [syncMessage]);

  const handleSync = useCallback(async () => {
    if (isSyncing || isOffline) return;

    const result = await forceSync();
    setSyncMessage(result.message);
  }, [isSyncing, isOffline]);

  // Don't render if nothing to show
  if (!isOffline && pendingCount === 0 && !showWhenOnline) {
    return null;
  }

  const backgroundColor = isOffline ? '#ff9500' : '#007aff';
  const icon = isOffline ? 'cloud-offline-outline' : 'cloud-upload-outline';
  const statusText = isOffline
    ? 'Offline'
    : pendingCount > 0
    ? `${pendingCount} pending`
    : 'Online';

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor, opacity: fadeAnim },
      ]}
    >
      <TouchableOpacity
        style={styles.touchable}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <View style={styles.mainRow}>
          <Ionicons name={icon} size={18} color="#ffffff" />
          <Text style={styles.statusText}>{statusText}</Text>

          {pendingCount > 0 && !isOffline && (
            <TouchableOpacity
              style={styles.syncButton}
              onPress={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="sync-outline" size={14} color="#ffffff" />
                  <Text style={styles.syncButtonText}>Sync</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {(isOffline || pendingCount > 0) && (
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#ffffff"
              style={styles.chevron}
            />
          )}
        </View>

        {expanded && (
          <View style={styles.expandedContent}>
            {isOffline ? (
              <Text style={styles.expandedText}>
                Check-ins will be saved locally and synced when you're back online.
              </Text>
            ) : pendingCount > 0 ? (
              <Text style={styles.expandedText}>
                {pendingCount} check-in{pendingCount === 1 ? '' : 's'} waiting to sync.
                {'\n'}Tap Sync or they'll sync automatically.
              </Text>
            ) : (
              <Text style={styles.expandedText}>
                All check-ins are synced.
              </Text>
            )}
          </View>
        )}

        {syncMessage && (
          <View style={styles.syncMessageContainer}>
            <Text style={styles.syncMessage}>{syncMessage}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  touchable: {
    padding: 12,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  syncButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  chevron: {
    marginLeft: 4,
  },
  expandedContent: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  expandedText: {
    fontSize: 13,
    color: '#ffffff',
    lineHeight: 18,
  },
  syncMessageContainer: {
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    padding: 8,
  },
  syncMessage: {
    fontSize: 12,
    color: '#ffffff',
    textAlign: 'center',
  },
});

export default OfflineIndicator;
