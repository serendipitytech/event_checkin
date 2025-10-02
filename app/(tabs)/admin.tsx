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
import { canManageAttendees, describeRole, normalizeRole } from '../../services/permissions';

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
    events,
    selectedEvent,
    setSelectedEventId,
    loading: supabaseLoading
  } = useSupabase();
  const currentRole = normalizeRole(selectedEvent?.role);
  const canManageRoster = canManageAttendees(currentRole);
  const [autoRefreshInterval, setAutoRefreshIntervalState] = useState<number>(
    getAutoRefreshInterval()
  );

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

    Alert.alert(
      'Roster Import',
      'File import for CSV/XLSX will live here. Decide on the preferred mobile picker workflow before enabling this action.'
    );
    importAttendeesFromFile('FILE_URI_PLACEHOLDER');
  };

  const handleSyncSheet = () => {
    if (!canManageRoster) {
      Alert.alert('Restricted', 'Ask an event manager or admin to sync Google Sheets.');
      return;
    }

    Alert.alert(
      'Google Sheet Sync',
      'Google Sheet sync will route through the proxy once implemented.'
    );
    syncFromGoogleSheet('GOOGLE_SHEET_URL_PLACEHOLDER');
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

    Alert.alert(
      'Select Event',
      'Choose which event to manage.',
      [
        ...events.map((event) => ({
          text: event.eventName,
          onPress: () => setSelectedEventId(event.eventId)
        })),
        { text: 'Cancel', style: 'cancel' }
      ]
    );
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
          <Text style={styles.eventInfoValue}>{describeRole(currentRole)}</Text>
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

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Next Steps</Text>
        <Text style={styles.cardSubtitle}>
          - Integrate a file/document picker for roster uploads.
          {'\n'}- Confirm Google Sheet proxy usage and authentication.
          {'\n'}- Mirror additional admin toggles from the web UI (compact
          stats, preferences, etc.).
        </Text>
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
  }
});
