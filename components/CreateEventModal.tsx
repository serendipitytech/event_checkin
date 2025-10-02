import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { createEvent, type CreateEventData } from '../services/eventManagement';

type CreateEventModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: (eventId: string) => void;
};

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [eventData, setEventData] = useState<CreateEventData>({
    eventName: '',
    orgName: '',
    description: '',
    eventDate: '',
    location: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!eventData.eventName.trim()) {
      newErrors.eventName = 'Event name is required';
    }

    if (!eventData.orgName.trim()) {
      newErrors.orgName = 'Organization name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const eventId = await createEvent('owner', eventData); // Assuming user has owner role for new events
      onSuccess(eventId);
      handleClose();
    } catch (error) {
      Alert.alert(
        'Creation Failed',
        error instanceof Error ? error.message : 'Failed to create event. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEventData({
      eventName: '',
      orgName: '',
      description: '',
      eventDate: '',
      location: '',
    });
    setErrors({});
    onClose();
  };

  const updateField = (field: keyof CreateEventData, value: string) => {
    setEventData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Create New Event</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#8e8e93" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Event Details</Text>
            <Text style={styles.sectionDescription}>
              Create a new event and organization. You'll be set as the owner with full management permissions.
            </Text>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Event Name *</Text>
              <TextInput
                style={[styles.input, errors.eventName && styles.inputError]}
                value={eventData.eventName}
                onChangeText={(value) => updateField('eventName', value)}
                placeholder="Enter event name"
                placeholderTextColor="#8e8e93"
                autoCapitalize="words"
              />
              {errors.eventName && <Text style={styles.errorText}>{errors.eventName}</Text>}
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Organization Name *</Text>
              <TextInput
                style={[styles.input, errors.orgName && styles.inputError]}
                value={eventData.orgName}
                onChangeText={(value) => updateField('orgName', value)}
                placeholder="Enter organization name"
                placeholderTextColor="#8e8e93"
                autoCapitalize="words"
              />
              {errors.orgName && <Text style={styles.errorText}>{errors.orgName}</Text>}
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={eventData.description}
                onChangeText={(value) => updateField('description', value)}
                placeholder="Optional event description"
                placeholderTextColor="#8e8e93"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Event Date</Text>
              <TextInput
                style={styles.input}
                value={eventData.eventDate}
                onChangeText={(value) => updateField('eventDate', value)}
                placeholder="YYYY-MM-DD (optional)"
                placeholderTextColor="#8e8e93"
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Location</Text>
              <TextInput
                style={styles.input}
                value={eventData.location}
                onChangeText={(value) => updateField('location', value)}
                placeholder="Event location (optional)"
                placeholderTextColor="#8e8e93"
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Next Steps</Text>
            <Text style={styles.sectionDescription}>
              After creating the event, you can:
            </Text>
            <View style={styles.stepsList}>
              <View style={styles.stepItem}>
                <Ionicons name="people-outline" size={16} color="#007aff" />
                <Text style={styles.stepText}>Invite team members to collaborate</Text>
              </View>
              <View style={styles.stepItem}>
                <Ionicons name="document-outline" size={16} color="#007aff" />
                <Text style={styles.stepText}>Import attendee roster from CSV or Google Sheets</Text>
              </View>
              <View style={styles.stepItem}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#007aff" />
                <Text style={styles.stepText}>Start checking in attendees</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.createButton, loading && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={20} color="#ffffff" />
                <Text style={styles.createButtonText}>Create Event</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
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
    alignItems: 'center',
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
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f1f1f',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6e6e73',
    lineHeight: 20,
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f1f1f',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1f1f1f',
    backgroundColor: '#ffffff',
  },
  inputError: {
    borderColor: '#e74c3c',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    color: '#e74c3c',
    marginTop: 4,
  },
  stepsList: {
    gap: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepText: {
    fontSize: 14,
    color: '#6e6e73',
    flex: 1,
  },
  footer: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e5e7',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007aff',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  createButtonDisabled: {
    backgroundColor: '#8e8e93',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
