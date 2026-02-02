/**
 * Lintnotes
 * - Purpose: Dashboard to view, manage, and share event access codes.
 * - Exports: AccessCodeDashboard (React component)
 * - Major deps: react-native primitives, services/codeManagement, expo-clipboard, expo-sharing
 * - Side effects: Calls Supabase RPCs via services; copies/shares to clipboard/share sheet.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import {
  listAccessCodes,
  revokeAccessCode,
  getCodeStatus,
  type AccessCode,
} from '../services/codeManagement';
import { generateAccessCodeLink, getShareMessage } from '../services/qrCodeGeneration';
import CreateAccessCodeModal from './CreateAccessCodeModal';
import QRCodeModal from './QRCodeModal';

type AccessCodeDashboardProps = {
  visible: boolean;
  eventId: string;
  eventName?: string;
  onClose: () => void;
};

export const AccessCodeDashboard: React.FC<AccessCodeDashboardProps> = ({
  visible,
  eventId,
  eventName,
  onClose,
}) => {
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInactiveCodes, setShowInactiveCodes] = useState(false);
  const [qrModalCode, setQrModalCode] = useState<{ code: string; eventId: string } | null>(null);

  const fetchCodes = useCallback(async () => {
    setError(null);
    const result = await listAccessCodes(eventId);
    if (result.success && result.codes) {
      setCodes(result.codes);
    } else {
      setError(result.error ?? 'Failed to load access codes');
    }
  }, [eventId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCodes();
    setRefreshing(false);
  }, [fetchCodes]);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      fetchCodes().finally(() => setLoading(false));
    }
  }, [visible, fetchCodes]);

  const activeCodes = codes.filter((code) => getCodeStatus(code) === 'active');
  const inactiveCodes = codes.filter((code) => getCodeStatus(code) !== 'active');

  const handleRevoke = (code: AccessCode) => {
    Alert.alert(
      'Revoke Access Code',
      'This will permanently disable this code. Anyone who has it will no longer be able to use it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            const result = await revokeAccessCode(code.id);
            if (result.success) {
              await fetchCodes();
            } else {
              Alert.alert('Error', result.error ?? 'Failed to revoke code');
            }
          },
        },
      ]
    );
  };

  const handleCopyLink = async (code: AccessCode) => {
    try {
      const link = generateAccessCodeLink('COPY_UNAVAILABLE', code.eventId);
      Alert.alert(
        'Link Not Available',
        'For security, the original code is not stored. Share the code when creating it, or create a new code.'
      );
    } catch {
      Alert.alert('Error', 'Failed to generate link');
    }
  };

  const handleShare = async (code: AccessCode) => {
    const sharingAvailable = await Sharing.isAvailableAsync();
    if (!sharingAvailable) {
      Alert.alert('Sharing Not Available', 'Sharing is not supported on this device.');
      return;
    }

    Alert.alert(
      'Share Not Available',
      'For security, the original code is not stored. Share the code when creating it, or create a new code.'
    );
  };

  const handleShowQR = (code: AccessCode) => {
    Alert.alert(
      'QR Not Available',
      'For security, the original code is not stored. Share the code when creating it, or create a new code.'
    );
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) {
      return 'Expired';
    }

    if (diffHours < 1) {
      return 'Expires soon';
    }

    if (diffHours < 24) {
      return `${diffHours}h remaining`;
    }

    if (diffDays < 7) {
      return `${diffDays}d remaining`;
    }

    return formatDate(date);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return '#34c759';
      case 'expired':
        return '#ff9500';
      case 'revoked':
        return '#ff3b30';
      case 'exhausted':
        return '#8e8e93';
      default:
        return '#8e8e93';
    }
  };

  const renderCodeCard = (code: AccessCode) => {
    const status = getCodeStatus(code);
    const statusColor = getStatusColor(status);
    const isActive = status === 'active';

    return (
      <View key={code.id} style={[styles.codeCard, !isActive && styles.codeCardInactive]}>
        <View style={styles.codeCardHeader}>
          <View style={styles.codeRoleBadge}>
            <Ionicons
              name={code.role === 'manager' ? 'settings-outline' : 'checkbox-outline'}
              size={14}
              color="#007aff"
            />
            <Text style={styles.codeRoleText}>
              {code.role === 'manager' ? 'Manager' : 'Checker'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </View>
        </View>

        {code.note && (
          <Text style={styles.codeNote} numberOfLines={1}>
            {code.note}
          </Text>
        )}

        <View style={styles.codeDetails}>
          <View style={styles.codeDetailItem}>
            <Ionicons name="people-outline" size={14} color="#8e8e93" />
            <Text style={styles.codeDetailText}>
              {code.maxUses === null
                ? `${code.usedCount} uses`
                : `${code.usedCount}/${code.maxUses} uses`}
            </Text>
          </View>

          <View style={styles.codeDetailItem}>
            <Ionicons name="time-outline" size={14} color="#8e8e93" />
            <Text style={styles.codeDetailText}>
              {code.expiresAt ? formatRelativeTime(code.expiresAt) : 'Never expires'}
            </Text>
          </View>

          <View style={styles.codeDetailItem}>
            <Ionicons name="calendar-outline" size={14} color="#8e8e93" />
            <Text style={styles.codeDetailText}>Created {formatDate(code.createdAt)}</Text>
          </View>
        </View>

        {isActive && (
          <View style={styles.codeActions}>
            <TouchableOpacity
              style={styles.codeActionButton}
              onPress={() => handleRevoke(code)}
            >
              <Ionicons name="close-circle-outline" size={18} color="#ff3b30" />
              <Text style={[styles.codeActionText, { color: '#ff3b30' }]}>Revoke</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="key-outline" size={48} color="#d1d1d6" />
      <Text style={styles.emptyStateTitle}>No Access Codes</Text>
      <Text style={styles.emptyStateDescription}>
        Create an access code to allow others to check in attendees for this event.
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Access Codes</Text>
            {eventName && <Text style={styles.subtitle}>{eventName}</Text>}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#8e8e93" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007aff" />
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color="#ffffff" />
              <Text style={styles.createButtonText}>Create New Code</Text>
            </TouchableOpacity>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={handleRefresh}>
                  <Text style={styles.retryText}>Tap to retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {!error && activeCodes.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Active Codes ({activeCodes.length})
                </Text>
                {activeCodes.map(renderCodeCard)}
              </View>
            ) : !error && codes.length === 0 ? (
              renderEmptyState()
            ) : null}

            {inactiveCodes.length > 0 && (
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.collapsibleHeader}
                  onPress={() => setShowInactiveCodes(!showInactiveCodes)}
                >
                  <Text style={styles.sectionTitleInactive}>
                    Inactive Codes ({inactiveCodes.length})
                  </Text>
                  <Ionicons
                    name={showInactiveCodes ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#8e8e93"
                  />
                </TouchableOpacity>
                {showInactiveCodes && inactiveCodes.map(renderCodeCard)}
              </View>
            )}

            <View style={styles.bottomSpacer} />
          </ScrollView>
        )}
      </View>

      <CreateAccessCodeModal
        visible={showCreateModal}
        eventId={eventId}
        eventName={eventName}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          fetchCodes();
        }}
      />

      {qrModalCode && (
        <QRCodeModal
          visible={!!qrModalCode}
          code={qrModalCode.code}
          eventId={qrModalCode.eventId}
          eventName={eventName}
          onClose={() => setQrModalCode(null)}
        />
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f3f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e7',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f1f1f',
  },
  subtitle: {
    fontSize: 13,
    color: '#8e8e93',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007aff',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 20,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f1f1f',
    marginBottom: 12,
  },
  sectionTitleInactive: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8e8e93',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  codeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  codeCardInactive: {
    opacity: 0.7,
  },
  codeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  codeRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e8f2ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  codeRoleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007aff',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  codeNote: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f1f1f',
    marginBottom: 8,
  },
  codeDetails: {
    gap: 6,
  },
  codeDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeDetailText: {
    fontSize: 13,
    color: '#8e8e93',
  },
  codeActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f2f2f2',
  },
  codeActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  codeActionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f1f1f',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  bottomSpacer: {
    height: 40,
  },
  errorContainer: {
    backgroundColor: '#fff2f0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#ff3b30',
    textAlign: 'center',
    marginBottom: 8,
  },
  retryText: {
    fontSize: 14,
    color: '#007aff',
    fontWeight: '600',
  },
});

export default AccessCodeDashboard;
