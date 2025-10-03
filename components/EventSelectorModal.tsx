import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';
import type { EventSummary } from '../services/events';

interface EventSelectorModalProps {
  visible: boolean;
  events: EventSummary[];
  selectedEventId: string | null;
  loading?: boolean;
  onClose: () => void;
  onSelectEvent: (eventId: string) => void;
}

export const EventSelectorModal: React.FC<EventSelectorModalProps> = ({
  visible,
  events,
  selectedEventId,
  loading = false,
  onClose,
  onSelectEvent
}) => {
  const handleSelectEvent = (eventId: string) => {
    if (eventId === selectedEventId) {
      // Event is already selected, just close the modal
      onClose();
      return;
    }
    
    onSelectEvent(eventId);
    onClose();
  };

  const renderEventItem = ({ item }: { item: EventSummary }) => {
    const isSelected = item.eventId === selectedEventId;
    const isDisabled = events.length === 1; // Disable if only one event
    
    return (
      <TouchableOpacity
        style={[
          styles.eventItem,
          isSelected && styles.eventItemSelected,
          isDisabled && styles.eventItemDisabled
        ]}
        onPress={() => !isDisabled && handleSelectEvent(item.eventId)}
        disabled={isDisabled}
        activeOpacity={isDisabled ? 1 : 0.7}
      >
        <View style={styles.eventItemContent}>
          <Text style={[
            styles.eventName,
            isSelected && styles.eventNameSelected,
            isDisabled && styles.eventNameDisabled
          ]}>
            {item.eventName}
          </Text>
          {isSelected && (
            <View style={styles.selectedIndicator}>
              <Text style={styles.selectedIndicatorText}>✓</Text>
            </View>
          )}
        </View>
        {item.role && (
          <Text style={[
            styles.eventRole,
            isSelected && styles.eventRoleSelected,
            isDisabled && styles.eventRoleDisabled
          ]}>
            {item.role}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1f1f1f" />
          <Text style={styles.loadingText}>Loading events...</Text>
        </View>
      );
    }

    if (events.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Events Available</Text>
          <Text style={styles.emptySubtitle}>
            You don't have access to any events yet. Contact your administrator to get access.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={events}
        keyExtractor={(item) => item.eventId}
        renderItem={renderEventItem}
        style={styles.eventsList}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Event</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
        
        {renderContent()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f5f7'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1'
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f1f1f'
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#007AFF'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6e6e73'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f1f1f',
    marginBottom: 8
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6e6e73',
    textAlign: 'center',
    lineHeight: 20
  },
  eventsList: {
    flex: 1,
    paddingHorizontal: 20
  },
  eventItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  eventItemSelected: {
    backgroundColor: '#e3f2fd',
    borderWidth: 2,
    borderColor: '#2196f3'
  },
  eventItemDisabled: {
    backgroundColor: '#f8f8f8',
    opacity: 0.6
  },
  eventItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  eventName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f1f1f',
    flex: 1
  },
  eventNameSelected: {
    color: '#1976d2'
  },
  eventNameDisabled: {
    color: '#9e9e9e'
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2196f3',
    justifyContent: 'center',
    alignItems: 'center'
  },
  selectedIndicatorText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold'
  },
  eventRole: {
    fontSize: 12,
    color: '#6e6e73',
    textTransform: 'capitalize'
  },
  eventRoleSelected: {
    color: '#1976d2'
  },
  eventRoleDisabled: {
    color: '#bdbdbd'
  }
});
