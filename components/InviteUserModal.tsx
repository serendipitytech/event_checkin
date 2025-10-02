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
import { inviteUserToEvent, type InviteUserData } from '../services/eventManagement';
import { getAvailableRoles, type EventRole } from '../services/permissions';

type InviteUserModalProps = {
  visible: boolean;
  eventId: string;
  userRole: EventRole;
  onClose: () => void;
  onSuccess: () => void;
};

export const InviteUserModal: React.FC<InviteUserModalProps> = ({
  visible,
  eventId,
  userRole,
  onClose,
  onSuccess,
}) => {
  const [inviteData, setInviteData] = useState<InviteUserData>({
    email: '',
    role: 'checker',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const availableRoles = getAvailableRoles(userRole);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!inviteData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!inviteData.role) {
      newErrors.role = 'Please select a role';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInvite = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      await inviteUserToEvent(userRole, eventId, inviteData);
      onSuccess();
      handleClose();
    } catch (error) {
      Alert.alert(
        'Invitation Failed',
        error instanceof Error ? error.message : 'Failed to send invitation. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setInviteData({
      email: '',
      role: 'checker',
      message: '',
    });
    setErrors({});
    onClose();
  };

  const updateField = (field: keyof InviteUserData, value: string) => {
    setInviteData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const getRoleDescription = (role: EventRole): string => {
    switch (role) {
      case 'admin':
        return 'Can manage events and invite users';
      case 'manager':
        return 'Can manage attendees and check-ins';
      case 'checker':
        return 'Can only check in attendees';
      case 'member':
        return 'Basic access to view event information';
      default:
        return '';
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
          <Text style={styles.title}>Invite User</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#8e8e93" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>User Details</Text>
            <Text style={styles.sectionDescription}>
              Invite a user to collaborate on this event. They'll receive an email with instructions to join.
            </Text>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Email Address *</Text>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                value={inviteData.email}
                onChangeText={(value) => updateField('email', value)}
                placeholder="user@example.com"
                placeholderTextColor="#8e8e93"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Role *</Text>
              <View style={styles.roleContainer}>
                {availableRoles.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleOption,
                      inviteData.role === role && styles.roleOptionActive
                    ]}
                    onPress={() => updateField('role', role)}
                  >
                    <View style={styles.roleHeader}>
                      <Ionicons
                        name={inviteData.role === role ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={inviteData.role === role ? '#007aff' : '#8e8e93'}
                      />
                      <Text style={[
                        styles.roleTitle,
                        inviteData.role === role && styles.roleTitleActive
                      ]}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </Text>
                    </View>
                    <Text style={styles.roleDescription}>
                      {getRoleDescription(role)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.role && <Text style={styles.errorText}>{errors.role}</Text>}
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Personal Message</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={inviteData.message}
                onChangeText={(value) => updateField('message', value)}
                placeholder="Optional personal message to include with the invitation"
                placeholderTextColor="#8e8e93"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What happens next?</Text>
            <View style={styles.stepsList}>
              <View style={styles.stepItem}>
                <Ionicons name="mail-outline" size={16} color="#007aff" />
                <Text style={styles.stepText}>An invitation email will be sent to the user</Text>
              </View>
              <View style={styles.stepItem}>
                <Ionicons name="person-add-outline" size={16} color="#007aff" />
                <Text style={styles.stepText}>They can accept the invitation to join the event</Text>
              </View>
              <View style={styles.stepItem}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#007aff" />
                <Text style={styles.stepText}>They'll have access based on the role you assigned</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.inviteButton, loading && styles.inviteButtonDisabled]}
            onPress={handleInvite}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="send-outline" size={20} color="#ffffff" />
                <Text style={styles.inviteButtonText}>Send Invitation</Text>
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
  roleContainer: {
    gap: 12,
  },
  roleOption: {
    borderWidth: 1,
    borderColor: '#e5e5e7',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#ffffff',
  },
  roleOptionActive: {
    borderColor: '#007aff',
    backgroundColor: '#f0f8ff',
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f1f1f',
  },
  roleTitleActive: {
    color: '#007aff',
  },
  roleDescription: {
    fontSize: 14,
    color: '#6e6e73',
    marginLeft: 28,
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
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007aff',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  inviteButtonDisabled: {
    backgroundColor: '#8e8e93',
  },
  inviteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
