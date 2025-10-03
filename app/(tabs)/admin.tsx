import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import {
  importAttendeesFromFile,
  resetAllCheckins,
  syncFromGoogleSheet
} from '../../services/attendees';
import {
  emitRefreshAttendees,
  addAutoRefreshListener,
  getAutoRefreshInterval,
  setAutoRefreshInterval
} from '../../services/attendeeEvents';
import { useSupabase } from '../../hooks/useSupabase';
import { usePermissions } from '../../hooks/usePermissions';
import { useRealtimeConnection } from '../../hooks/useRealtime';
import { describeRole, normalizeRole } from '../../services/permissions';
import { RosterImportModal } from '../../components/RosterImportModal';
import { CreateEventModal } from '../../components/CreateEventModal';
import { InviteUserModal } from '../../components/InviteUserModal';
import { EventSelectorModal } from '../../components/EventSelectorModal';
import type { ImportResult } from '../../services/rosterImport';

const AUTO_REFRESH_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '1s', value: 1000 },
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: '15s', value: 15000 },
  { label: '30s', value: 30000 }
] as const;

export default function AdminScreen() {
  const {
    session,
    events,
    selectedEvent,
    setSelectedEventId,
    loading: supabaseLoading,
    signIn,
    signOut
  } = useSupabase();
  const {
    canManageAttendees: canManageRoster,
    canCreateEvents,
    canInviteUsers,
    canDeleteEvents,
    canManageOrganization,
    describeRole,
    currentRole
  } = usePermissions();
  const { hasAnyConnection, hasErrors, totalReconnectAttempts, connectionCount } = useRealtimeConnection();
  const [autoRefreshInterval, setAutoRefreshIntervalState] = useState<number>(
    getAutoRefreshInterval()
  );
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [createEventModalVisible, setCreateEventModalVisible] = useState(false);
  const [inviteUserModalVisible, setInviteUserModalVisible] = useState(false);
  const [eventSelectorModalVisible, setEventSelectorModalVisible] = useState(false);

  useEffect(() => {
    const remove = addAutoRefreshListener((interval) => {
      setAutoRefreshIntervalState(interval);
    });
    return remove;
  }, []);

  const handleResetAll = () => {
    if (!selectedEvent) {
      Alert.alert('No event selected', 'Select an event before resetting attendees.');
      return;
    }

    if (!canManageRoster) {
      Alert.alert('Restricted', 'Your role does not allow resetting attendee check-ins.');
      return;
    }

    Alert.alert(
      'Reset All Check-Ins',
      'This will move every attendee back to Pending. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetAllCheckins(selectedEvent.eventId);
              emitRefreshAttendees({ silent: true });
              Alert.alert('Reset complete', 'All attendees were marked Pending.');
            } catch (err) {
              console.error('Reset all check-ins failed', err);
              Alert.alert('Unable to reset', 'Check your connection and try again.');
            }
          }
        }
      ]
    );
  };

  const handleImportRoster = () => {
    if (!canManageRoster) {
      Alert.alert('Restricted', 'Ask an event manager or admin to import attendee files.');
      return;
    }

    if (!selectedEvent) {
      Alert.alert('No Event Selected', 'Please select an event before importing attendees.');
      return;
    }

    setImportModalVisible(true);
  };

  const handleImportSuccess = (result: ImportResult) => {
    if (result.success) {
      Alert.alert(
        'Import Successful',
        `Successfully imported ${result.imported} attendees.${result.skipped > 0 ? ` ${result.skipped} rows were skipped.` : ''}`,
        [{ text: 'OK' }]
      );
      emitRefreshAttendees({ silent: true });
    }
  };

  const handleCreateEventSuccess = (eventId: string) => {
    Alert.alert(
      'Event Created',
      'Your new event has been created successfully. You can now invite team members and import attendees.',
      [{ text: 'OK' }]
    );
    // Refresh events list - this will be handled by the SupabaseContext
  };

  const handleInviteUserSuccess = () => {
    Alert.alert(
      'Invitation Sent',
      'The invitation has been sent successfully. The user will receive an email with instructions to join.',
      [{ text: 'OK' }]
    );
  };

  const handleSyncSheet = () => {
    if (!canManageRoster) {
      Alert.alert('Restricted', 'Ask an event manager or admin to sync Google Sheets.');
      return;
    }

    if (!selectedEvent) {
      Alert.alert('No Event Selected', 'Please select an event before syncing Google Sheets.');
      return;
    }

    setImportModalVisible(true);
  };

  const handleSelectAutoRefresh = (interval: number) => {
    setAutoRefreshIntervalState(interval);
    setAutoRefreshInterval(interval);
  };

  const handleSelectEvent = () => {
    if (supabaseLoading) {
      Alert.alert('Loading', 'Fetching your events, please wait.');
      return;
    }

    if (!events.length) {
      Alert.alert('No Events', 'You do not have access to any events yet.');
      return;
    }

    setEventSelectorModalVisible(true);
  };

  const handleEventSelection = (eventId: string) => {
    setSelectedEventId(eventId);
    // The modal will close automatically after selection
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Admin Tools</Text>
      <Text style={styles.description}>
        Manage roster imports, Google Sheet syncs, and bulk actions from this
        screen. Confirm the preferred import UX before wiring the remaining
        flows.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bulk Actions</Text>
        <Text style={styles.cardSubtitle}>
          Use these tools to reset the roster or reload data sources.
        </Text>
        <View style={styles.actions}>
          <ActionButton
            label="Import CSV/XLSX"
            variant="secondary"
            onPress={handleImportRoster}
            disabled={!canManageRoster}
          />
          <ActionButton
            label="Sync Google Sheet"
            variant="secondary"
            onPress={handleSyncSheet}
            disabled={!canManageRoster}
          />
          <ActionButton
            label="Reset Check-Ins"
            variant="danger"
            onPress={handleResetAll}
            disabled={!selectedEvent || !canManageRoster}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Auto Refresh</Text>
        <Text style={styles.cardSubtitle}>
          Choose how often the attendee list refreshes automatically.
        </Text>
        <View style={styles.autoRefreshOptions}>
          {AUTO_REFRESH_OPTIONS.map((option) => {
            const isActive = autoRefreshInterval === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => handleSelectAutoRefresh(option.value)}
                style={[styles.autoRefreshChip, isActive ? styles.autoRefreshChipActive : null]}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.autoRefreshChipLabel, isActive ? styles.autoRefreshChipLabelActive : null]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Real-time Status</Text>
        <Text style={styles.cardSubtitle}>
          Monitor real-time connection status and sync across devices.
        </Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Connection Status</Text>
          <View style={styles.statusValue}>
            <View style={[styles.statusIndicator, hasAnyConnection ? styles.statusConnected : styles.statusDisconnected]} />
            <Text style={styles.statusText}>
              {hasAnyConnection ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Active Connections</Text>
          <Text style={styles.statusValueText}>{connectionCount}</Text>
        </View>
        {hasErrors && (
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Reconnect Attempts</Text>
            <Text style={styles.statusValueText}>{totalReconnectAttempts}</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Event Settings</Text>
        <Text style={styles.cardSubtitle}>
          Manage which event you are viewing and how often attendee data refreshes.
        </Text>
        <View style={styles.eventInfoRow}>
          <Text style={styles.eventInfoLabel}>Current Event</Text>
          <Text style={styles.eventInfoValue}>
            {selectedEvent ? selectedEvent.eventName : 'No event selected'}
          </Text>
          <TouchableOpacity onPress={handleSelectEvent} style={styles.eventSwitcher}>
            <Text style={styles.eventSwitcherLabel}>Change</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.eventInfoRow}>
          <Text style={styles.eventInfoLabel}>Your Role</Text>
          <Text style={styles.eventInfoValue}>{describeRole()}</Text>
        </View>

        <Text style={styles.autoRefreshLabel}>Auto Refresh</Text>
        <View style={styles.autoRefreshOptions}>
          {AUTO_REFRESH_OPTIONS.map((option) => {
            const isActive = autoRefreshInterval === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => handleSelectAutoRefresh(option.value)}
                style={[styles.autoRefreshChip, isActive ? styles.autoRefreshChipActive : null]}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.autoRefreshChipLabel, isActive ? styles.autoRefreshChipLabelActive : null]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {canCreateEvents && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Event Management</Text>
          <Text style={styles.cardSubtitle}>
            Create new events and manage existing ones.
          </Text>
          <View style={styles.actions}>
            <ActionButton
              label="Create New Event"
              variant="primary"
              onPress={() => setCreateEventModalVisible(true)}
            />
            {canDeleteEvents && selectedEvent && (
              <ActionButton
                label="Delete Current Event"
                variant="danger"
                onPress={() => {
                  Alert.alert(
                    'Delete Event',
                    `Are you sure you want to delete "${selectedEvent.eventName}"? This action cannot be undone.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                          Alert.alert(
                            'Delete Event',
                            'Event deletion will be implemented in the next phase.'
                          );
                        }
                      }
                    ]
                  );
                }}
              />
            )}
          </View>
        </View>
      )}

      {canInviteUsers && selectedEvent && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>User Management</Text>
          <Text style={styles.cardSubtitle}>
            Invite users to collaborate on this event.
          </Text>
          <View style={styles.actions}>
            <ActionButton
              label="Invite User"
              variant="secondary"
              onPress={() => setInviteUserModalVisible(true)}
            />
            <ActionButton
              label="Manage Users"
              variant="secondary"
              onPress={() => {
                Alert.alert(
                  'Manage Users',
                  'User management will be implemented in the next phase.',
                  [{ text: 'OK' }]
                );
              }}
            />
          </View>
        </View>
      )}

      {canManageOrganization && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Organization Settings</Text>
          <Text style={styles.cardSubtitle}>
            Manage organization-wide settings and permissions.
          </Text>
          <View style={styles.actions}>
            <ActionButton
              label="Organization Settings"
              variant="secondary"
              onPress={() => {
                Alert.alert(
                  'Organization Settings',
                  'Organization management will be implemented in the next phase.',
                  [{ text: 'OK' }]
                );
              }}
            />
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Next Steps</Text>
        <Text style={styles.cardSubtitle}>
          - Integrate a file/document picker for roster uploads.
          {'\n'}- Confirm Google Sheet proxy usage and authentication.
          {'\n'}- Implement event creation and user invitation flows.
          {'\n'}- Add role-based UI components and permissions.
        </Text>
      </View>

      <RosterImportModal
        visible={importModalVisible}
        eventId={selectedEvent?.eventId || ''}
        onClose={() => setImportModalVisible(false)}
        onSuccess={handleImportSuccess}
      />

      <CreateEventModal
        visible={createEventModalVisible}
        onClose={() => setCreateEventModalVisible(false)}
        onSuccess={handleCreateEventSuccess}
      />

      <InviteUserModal
        visible={inviteUserModalVisible}
        eventId={selectedEvent?.eventId || ''}
        userRole={currentRole}
        onClose={() => setInviteUserModalVisible(false)}
        onSuccess={handleInviteUserSuccess}
      />

      <EventSelectorModal
        visible={eventSelectorModalVisible}
        events={events}
        selectedEventId={selectedEvent?.eventId || null}
        loading={supabaseLoading}
        onClose={() => setEventSelectorModalVisible(false)}
        onSelectEvent={handleEventSelection}
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        <Text style={styles.cardSubtitle}>
          {session ? 'Sign out of your account.' : 'Sign in to access admin features.'}
        </Text>
        <View style={styles.actions}>
          <ActionButton
            label={session ? "Sign Out" : "Sign In"}
            variant={session ? "danger" : "primary"}
            disabled={false}
            onPress={() => {
              if (session) {
                Alert.alert(
                  'Sign Out',
                  'Are you sure you want to sign out?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Sign Out',
                      style: 'destructive',
                      onPress: () => {
                        void signOut();
                      }
                    }
                  ]
                );
              } else {
                void signIn();
              }
            }}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 24,
    backgroundColor: '#f4f5f7'
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1f1f1f'
  },
  description: {
    fontSize: 16,
    color: '#4a4a4a',
    lineHeight: 22
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f1f1f'
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#555555',
    lineHeight: 20
  },
  actions: {
    gap: 12
  },
  eventInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  eventInfoLabel: {
    fontSize: 12,
    color: '#6e6e73'
  },
  eventInfoValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1f1f1f'
  },
  eventSwitcher: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f0f0f2'
  },
  eventSwitcherLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f1f1f'
  },
  autoRefreshOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  autoRefreshLabel: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 12,
    color: '#6e6e73'
  },
  autoRefreshChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f0f0f2'
  },
  autoRefreshChipActive: {
    backgroundColor: '#1f1f1f'
  },
  autoRefreshChipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f1f1f'
  },
  autoRefreshChipLabelActive: {
    color: '#ffffff'
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8
  },
  statusLabel: {
    fontSize: 14,
    color: '#6e6e73'
  },
  statusValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  statusValueText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f1f1f'
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  statusConnected: {
    backgroundColor: '#27ae60'
  },
  statusDisconnected: {
    backgroundColor: '#e74c3c'
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f1f1f'
  }
});
