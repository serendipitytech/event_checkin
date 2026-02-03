/**
 * Lintnotes
 * - Purpose: Modal UI for entering an event access code and redeeming it.
 * - Exports: CodeRedeemModal
 */
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { redeemEventCode } from '../services/accessCodes';
import { useModalWidth } from '../hooks/useModalWidth';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: (args: { eventId: string; role: string }) => void;
  initialCode?: string;
};

const CODE_LENGTH = 8;

// Strip non-alphanumeric characters and limit to CODE_LENGTH
const normalizeCodeInput = (input: string): string => {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
};

// Format code for display: XXXX-XXXX
const formatCodeDisplay = (code: string): string => {
  const clean = normalizeCodeInput(code);
  if (clean.length <= 4) return clean;
  return `${clean.slice(0, 4)}-${clean.slice(4)}`;
};

export const CodeRedeemModal: React.FC<Props> = ({ visible, onClose, onSuccess, initialCode }) => {
  const [code, setCode] = useState(initialCode ? normalizeCodeInput(initialCode) : '');
  const [loading, setLoading] = useState(false);
  const modalWidth = useModalWidth();

  useEffect(() => {
    if (initialCode && visible) {
      setCode(normalizeCodeInput(initialCode));
    }
  }, [initialCode, visible]);

  const handleCodeChange = (text: string) => {
    setCode(normalizeCodeInput(text));
  };

  const handleRedeem = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      Alert.alert('Enter Code', 'Please enter your access code.');
      return;
    }
    setLoading(true);
    try {
      const res = await redeemEventCode(trimmed);
      if (!res.success) {
        Alert.alert('Invalid Code', res.error || 'Please check the code and try again.');
        return;
      }
      onSuccess({ eventId: res.eventId!, role: res.role! });
      setCode('');
      onClose();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.modal, { width: modalWidth }]}>
          <Text style={styles.title}>Enter Access Code</Text>
          <Text style={styles.subtitle}>Ask your event planner for your 8-character code.</Text>
          <View style={styles.codeInputContainer}>
            <TextInput
              style={styles.codeInput}
              value={formatCodeDisplay(code)}
              onChangeText={handleCodeChange}
              placeholder="XXXX-XXXX"
              placeholderTextColor="#9ca3af"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!loading}
              maxLength={9} // 8 chars + 1 dash
              textAlign="center"
            />
            <Text style={styles.codeHint}>{code.length}/8 characters</Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.button, styles.cancel]} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.primary]} onPress={handleRedeem} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="key-outline" size={18} color="#fff" />
                  <Text style={styles.buttonText}>Redeem</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modal: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
  subtitle: { color: '#6b7280', marginBottom: 12 },
  codeInputContainer: { marginBottom: 12 },
  codeInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 16,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  codeHint: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  cancel: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d1d5db' },
  primary: { backgroundColor: '#111827' },
  buttonText: { color: '#fff', fontWeight: '600' },
  cancelText: { color: '#111827', fontWeight: '600' },
});

export default CodeRedeemModal;
