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
import { RequestInfoModal } from '../../components/RequestInfoModal';
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
  const [requestInfoModalVisible, setRequestInfoModalVisible] = useState(false);

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

  // Conditional rendering based on authentication state
  if (!session) {
    // Logged-out state - Show onboarding and request info
    return (
      <View style={styles.pageContainer}>
        <ScrollView contentContainerStyle={styles.loggedOutContainer}>
          <Text style={styles.heading}>Event Check-In</Text>
          <Text style={styles.loggedOutDescription}>
            Ask your event planner to invite you to an event and you'll be able to check in attendees.{'\n\n'}
            If you're an event planner and want to use this app, tap below to request more info.
          </Text>
        </ScrollView>
        
        {/* Floating Buttons for Logged-Out State */}
        <View style={styles.loggedOutButtonContainer}>
          <TouchableOpacity
            style={styles.goldButton}
            onPress={() => setRequestInfoModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.goldButtonText}>Request Info</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.goldButton}
            onPress={() => void signIn()}
            activeOpacity={0.8}
          >
            <Text style={styles.goldButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* Request Info Modal */}
        <RequestInfoModal
          visible={requestInfoModalVisible}
          onClose={() => setRequestInfoModalVisible(false)}
        />
      </View>
    );
  }

  // Logged-in state - Show normal Admin Tools
  return (
    <View style={styles.pageContainer}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>Admin Tools</Text>
        <Text style={styles.description}>
          Welcome {session?.user?.email || session?.user?.user_metadata?.name || 'User'}. You can administer your events below and invite additional users to your events.
        </Text>

        {/* Auto Refresh - Moved to top for all roles */}
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


        {/* Event Settings */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Event Settings</Text>
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
        </View>

        {/* TODO v2 - Hide these sections until v2 */}
        {/* 
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
        */}

        {/* Real-time Status - Moved to bottom */}
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

        {/* Bulk Actions - Moved to very bottom */}
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
      </ScrollView>
      
      {/* Floating Sign Out Button */}
      <View style={styles.floatingButtonContainer}>
        <TouchableOpacity
          style={styles.floatingSignOutButton}
          onPress={() => {
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
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.floatingSignOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: '#f4f5f7'
  },
  container: {
    padding: 24,
    gap: 24,
    paddingBottom: 100 // Add bottom padding to account for floating button
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
  },
  inviteButtonContainer: {
    marginTop: 16,
    marginBottom: 8
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    alignItems: 'center'
  },
  floatingSignOutButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6
  },
  floatingSignOutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  // Logged-out state styles
  loggedOutContainer: {
    padding: 24,
    gap: 24,
    paddingBottom: 200, // Extra padding for floating buttons
    backgroundColor: '#f4f5f7',
    flexGrow: 1,
    justifyContent: 'center'
  },
  loggedOutDescription: {
    fontSize: 18,
    color: '#4a4a4a',
    lineHeight: 26,
    textAlign: 'center'
  },
  loggedOutButtonContainer: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    gap: 16
  },
  goldButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6
  },
  goldButtonText: {
    color: '#1f1f1f',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  }
});
