/**
 * Lintnotes
 * - Purpose: Modal UI to collect interest/contact info from potential users and store it in Supabase.
 * - Exports: RequestInfoModal (React component)
 * - Major deps: react-native primitives, services/supabase client
 * - Side effects: Inserts a record into the interest_requests table when submitting.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { getSupabaseClient } from '../services/supabase';

interface RequestInfoModalProps {
  visible: boolean;
  onClose: () => void;
}

export const RequestInfoModal: React.FC<RequestInfoModalProps> = ({
  visible,
  onClose
}) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.email.trim()) {
      Alert.alert('Required Field', 'Please enter your email address.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = getSupabaseClient();
      
      const { error } = await supabase
        .from('interest_requests')
        .insert({
          name: formData.name.trim() || null,
          email: formData.email.trim(),
          organization: formData.organization.trim() || null,
          message: formData.message.trim() || null
        });

      if (error) {
        console.error('Error submitting interest request:', error);
        Alert.alert(
          'Submission Error',
          '❌ Could not submit request. Please try again.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Success
      Alert.alert(
        'Request Submitted',
        '✅ Thanks! We\'ll contact you soon.',
        [{ text: 'OK', onPress: onClose }]
      );

      // Reset form
      setFormData({
        name: '',
        email: '',
        organization: '',
        message: ''
      });

    } catch (error) {
      console.error('Unexpected error:', error);
      Alert.alert(
        'Submission Error',
        '❌ Could not submit request. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Reset form and close
    setFormData({
      name: '',
      email: '',
      organization: '',
      message: ''
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Request Information</Text>
            <Text style={styles.subtitle}>
              Tell us about your event needs and we'll get back to you soon.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name (Optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(value) => handleInputChange('name', value)}
                placeholder="Your name"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                value={formData.email}
                onChangeText={(value) => handleInputChange('email', value)}
                placeholder="your.email@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Organization (Optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.organization}
                onChangeText={(value) => handleInputChange('organization', value)}
                placeholder="Your organization or company"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Message / Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.message}
                onChangeText={(value) => handleInputChange('message', value)}
                placeholder="Tell us about your event, expected attendance, or any specific requirements..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoCapitalize="sentences"
                autoCorrect={true}
              />
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f5f7'
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24
  },
  header: {
    marginBottom: 32
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f1f1f',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 16,
    color: '#4a4a4a',
    lineHeight: 22
  },
  form: {
    flex: 1,
    gap: 20
  },
  inputGroup: {
    gap: 8
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f1f1f'
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1f1f1f',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  textArea: {
    height: 100,
    paddingTop: 16
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 32,
    paddingBottom: 24
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4
  },
  cancelButton: {
    backgroundColor: '#6c757d'
  },
  submitButton: {
    backgroundColor: '#FFD700'
  },
  submitButtonDisabled: {
    backgroundColor: '#d4af37',
    opacity: 0.7
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600'
  },
  submitButtonText: {
    color: '#1f1f1f',
    fontSize: 16,
    fontWeight: '600'
  }
});
