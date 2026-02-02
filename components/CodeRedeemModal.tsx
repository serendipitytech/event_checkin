/**
 * Lintnotes
 * - Purpose: Modal UI for entering an event access code and redeeming it.
 * - Exports: CodeRedeemModal
 */
import React, { useState, useEffect } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { redeemEventCode } from '../services/accessCodes';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: (args: { eventId: string; role: string }) => void;
  initialCode?: string;
};

export const CodeRedeemModal: React.FC<Props> = ({ visible, onClose, onSuccess, initialCode }) => {
  const [code, setCode] = useState(initialCode ?? '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialCode && visible) {
      setCode(initialCode);
    }
  }, [initialCode, visible]);

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
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Enter Access Code</Text>
          <Text style={styles.subtitle}>Ask your event planner for your code.</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="ABC-123-XYZ"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!loading}
          />
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
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
  subtitle: { color: '#6b7280', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  cancel: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d1d5db' },
  primary: { backgroundColor: '#111827' },
  buttonText: { color: '#fff', fontWeight: '600' },
  cancelText: { color: '#111827', fontWeight: '600' },
});

export default CodeRedeemModal;
