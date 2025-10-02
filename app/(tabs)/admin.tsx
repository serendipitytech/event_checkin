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

const AUTO_REFRESH_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '1s', value: 1000 },
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: '15s', value: 15000 },
  { label: '30s', value: 30000 }
] as const;

export default function AdminScreen() {
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
              await resetAllCheckins();
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
    Alert.alert(
      'Roster Import',
      'File import for CSV/XLSX will live here. Decide on the preferred mobile picker workflow before enabling this action.'
    );
    importAttendeesFromFile('FILE_URI_PLACEHOLDER');
  };

  const handleSyncSheet = () => {
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
          />
          <ActionButton
            label="Sync Google Sheet"
            variant="secondary"
            onPress={handleSyncSheet}
          />
          <ActionButton
            label="Reset Check-Ins"
            variant="danger"
            onPress={handleResetAll}
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
  autoRefreshOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
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
