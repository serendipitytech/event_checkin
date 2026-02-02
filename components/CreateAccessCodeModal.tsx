/**
 * Lintnotes
 * - Purpose: Modal UI for managers to generate shareable event access codes.
 * - Exports: CreateAccessCodeModal (React component)
 * - Major deps: react-native primitives, services/codeManagement, expo-clipboard
 * - Side effects: Calls Supabase RPC via service; copies to clipboard.
 */
import React, { useState, useEffect } from 'react';
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
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import {
  createAccessCode,
  generateCodeString,
  formatCodeForDisplay,
  type AccessCodeRole,
} from '../services/codeManagement';
import { generateAccessCodeLink } from '../services/qrCodeGeneration';
import QRCodeModal from './QRCodeModal';

type ExpirationOption = {
  label: string;
  value: number | null;
};

const EXPIRATION_OPTIONS: ExpirationOption[] = [
  { label: 'Never expires', value: null },
  { label: '1 hour', value: 1 * 60 * 60 * 1000 },
  { label: '1 day', value: 24 * 60 * 60 * 1000 },
  { label: '1 week', value: 7 * 24 * 60 * 60 * 1000 },
  { label: '1 month', value: 30 * 24 * 60 * 60 * 1000 },
];

type MaxUsesOption = {
  label: string;
  value: number | null;
};

const MAX_USES_OPTIONS: MaxUsesOption[] = [
  { label: 'Unlimited', value: null },
  { label: '5 devices', value: 5 },
  { label: '10 devices', value: 10 },
  { label: '25 devices', value: 25 },
  { label: '50 devices', value: 50 },
];

type CreateAccessCodeModalProps = {
  visible: boolean;
  eventId: string;
  eventName?: string;
  onClose: () => void;
  onSuccess: () => void;
};

type ViewState = 'form' | 'success';

export const CreateAccessCodeModal: React.FC<CreateAccessCodeModalProps> = ({
  visible,
  eventId,
  eventName,
  onClose,
  onSuccess,
}) => {
  const [viewState, setViewState] = useState<ViewState>('form');
  const [role, setRole] = useState<AccessCodeRole>('checker');
  const [expirationIndex, setExpirationIndex] = useState(0);
  const [maxUsesIndex, setMaxUsesIndex] = useState(0);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    if (copiedCode) {
      const timer = setTimeout(() => setCopiedCode(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedCode]);

  useEffect(() => {
    if (copiedLink) {
      const timer = setTimeout(() => setCopiedLink(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedLink]);

  const resetForm = () => {
    setViewState('form');
    setRole('checker');
    setExpirationIndex(0);
    setMaxUsesIndex(0);
    setNote('');
    setGeneratedCode(null);
    setCopiedCode(false);
    setCopiedLink(false);
    setShowQRModal(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreate = async () => {
    setLoading(true);

    try {
      const plainCode = await generateCodeString(8);
      const expiresAt = EXPIRATION_OPTIONS[expirationIndex].value
        ? new Date(Date.now() + EXPIRATION_OPTIONS[expirationIndex].value!)
        : null;
      const maxUses = MAX_USES_OPTIONS[maxUsesIndex].value;

      const result = await createAccessCode(eventId, plainCode, {
        role,
        expiresAt,
        maxUses,
        note: note.trim() || null,
      });

      if (!result.success) {
        Alert.alert('Error', result.error ?? 'Failed to create access code');
        return;
      }

      setGeneratedCode(plainCode);
      setViewState('success');
      onSuccess();
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create access code'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!generatedCode) return;

    try {
      await Clipboard.setStringAsync(formatCodeForDisplay(generatedCode));
      setCopiedCode(true);
    } catch {
      Alert.alert('Error', 'Failed to copy code to clipboard');
    }
  };

  const handleCopyLink = async () => {
    if (!generatedCode) return;

    try {
      const link = generateAccessCodeLink(generatedCode, eventId);
      await Clipboard.setStringAsync(link);
      setCopiedLink(true);
    } catch {
      Alert.alert('Error', 'Failed to copy link to clipboard');
    }
  };

  const renderFormView = () => (
    <>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Code Settings</Text>
          <Text style={styles.sectionDescription}>
            Generate a shareable code that grants access to {eventName ? `"${eventName}"` : 'this event'}.
          </Text>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Role</Text>
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                style={[
                  styles.segmentedButton,
                  role === 'checker' && styles.segmentedButtonActive,
                ]}
                onPress={() => setRole('checker')}
              >
                <Ionicons
                  name="checkbox-outline"
                  size={16}
                  color={role === 'checker' ? '#ffffff' : '#6e6e73'}
                />
                <Text
                  style={[
                    styles.segmentedButtonText,
                    role === 'checker' && styles.segmentedButtonTextActive,
                  ]}
                >
                  Checker
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentedButton,
                  role === 'manager' && styles.segmentedButtonActive,
                ]}
                onPress={() => setRole('manager')}
              >
                <Ionicons
                  name="settings-outline"
                  size={16}
                  color={role === 'manager' ? '#ffffff' : '#6e6e73'}
                />
                <Text
                  style={[
                    styles.segmentedButtonText,
                    role === 'manager' && styles.segmentedButtonTextActive,
                  ]}
                >
                  Manager
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldHint}>
              {role === 'checker'
                ? 'Can check in attendees only'
                : 'Can manage attendees and invite others'}
            </Text>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Expiration</Text>
            <View style={styles.optionsList}>
              {EXPIRATION_OPTIONS.map((option, index) => (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    styles.optionItem,
                    expirationIndex === index && styles.optionItemActive,
                  ]}
                  onPress={() => setExpirationIndex(index)}
                >
                  <View style={styles.optionRadio}>
                    {expirationIndex === index && <View style={styles.optionRadioInner} />}
                  </View>
                  <Text
                    style={[
                      styles.optionText,
                      expirationIndex === index && styles.optionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Usage Limit</Text>
            <Text style={styles.fieldHint}>
              Maximum number of unique devices that can use this code
            </Text>
            <View style={styles.optionsList}>
              {MAX_USES_OPTIONS.map((option, index) => (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    styles.optionItem,
                    maxUsesIndex === index && styles.optionItemActive,
                  ]}
                  onPress={() => setMaxUsesIndex(index)}
                >
                  <View style={styles.optionRadio}>
                    {maxUsesIndex === index && <View style={styles.optionRadioInner} />}
                  </View>
                  <Text
                    style={[
                      styles.optionText,
                      maxUsesIndex === index && styles.optionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="e.g., Front desk team"
              placeholderTextColor="#8e8e93"
              autoCapitalize="sentences"
              maxLength={500}
            />
            <Text style={styles.fieldHint}>Internal note to help identify this code</Text>
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
              <Ionicons name="key-outline" size={20} color="#ffffff" />
              <Text style={styles.createButtonText}>Generate Code</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  const renderSuccessView = () => (
    <ScrollView
      style={styles.successScrollView}
      contentContainerStyle={styles.successContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.successIconContainer}>
        <Ionicons name="checkmark-circle" size={64} color="#34c759" />
      </View>

      <Text style={styles.successTitle}>Code Created!</Text>
      <Text style={styles.successDescription}>
        Share this code with your team. It will only be shown once.
      </Text>

      <View style={styles.codeDisplay}>
        <Text style={styles.codeText}>
          {generatedCode ? formatCodeForDisplay(generatedCode) : ''}
        </Text>
      </View>

      <View style={styles.warningBox}>
        <Ionicons name="warning-outline" size={20} color="#ff9500" />
        <Text style={styles.warningText}>
          Save this code now. It cannot be retrieved after closing this screen.
        </Text>
      </View>

      <View style={styles.successActions}>
        <TouchableOpacity
          style={[styles.copyButton, copiedCode && styles.copyButtonSuccess]}
          onPress={handleCopyCode}
        >
          <Ionicons
            name={copiedCode ? 'checkmark' : 'copy-outline'}
            size={20}
            color={copiedCode ? '#34c759' : '#007aff'}
          />
          <Text style={[styles.copyButtonText, copiedCode && styles.copyButtonTextSuccess]}>
            {copiedCode ? 'Copied!' : 'Copy Code'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.copyButton, copiedLink && styles.copyButtonSuccess]}
          onPress={handleCopyLink}
        >
          <Ionicons
            name={copiedLink ? 'checkmark' : 'link-outline'}
            size={20}
            color={copiedLink ? '#34c759' : '#007aff'}
          />
          <Text style={[styles.copyButtonText, copiedLink && styles.copyButtonTextSuccess]}>
            {copiedLink ? 'Copied!' : 'Copy Link'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.qrButton}
        onPress={() => setShowQRModal(true)}
      >
        <Ionicons name="qr-code-outline" size={20} color="#007aff" />
        <Text style={styles.qrButtonText}>Show QR Code</Text>
      </TouchableOpacity>

      <View style={styles.codeSummary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Role</Text>
          <Text style={styles.summaryValue}>{role === 'checker' ? 'Checker' : 'Manager'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Expires</Text>
          <Text style={styles.summaryValue}>{EXPIRATION_OPTIONS[expirationIndex].label}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Max Uses</Text>
          <Text style={styles.summaryValue}>{MAX_USES_OPTIONS[maxUsesIndex].label}</Text>
        </View>
        {note.trim() && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Note</Text>
            <Text style={styles.summaryValue}>{note.trim()}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.doneButton} onPress={handleClose}>
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>

      {generatedCode && (
        <QRCodeModal
          visible={showQRModal}
          code={generatedCode}
          eventId={eventId}
          eventName={eventName}
          onClose={() => setShowQRModal(false)}
        />
      )}
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {viewState === 'form' ? 'Create Access Code' : 'Access Code Created'}
          </Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#8e8e93" />
          </TouchableOpacity>
        </View>

        {viewState === 'form' ? renderFormView() : renderSuccessView()}
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
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f1f1f',
    marginBottom: 8,
  },
  fieldHint: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 6,
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
  segmentedControl: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentedButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e5e7',
    backgroundColor: '#ffffff',
  },
  segmentedButtonActive: {
    backgroundColor: '#007aff',
    borderColor: '#007aff',
  },
  segmentedButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6e6e73',
  },
  segmentedButtonTextActive: {
    color: '#ffffff',
  },
  optionsList: {
    gap: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
  },
  optionItemActive: {
    backgroundColor: '#e8f2ff',
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d1d6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007aff',
  },
  optionText: {
    fontSize: 14,
    color: '#6e6e73',
  },
  optionTextActive: {
    color: '#007aff',
    fontWeight: '500',
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
  successScrollView: {
    flex: 1,
  },
  successContainer: {
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  successIconContainer: {
    marginTop: 20,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f1f1f',
    marginBottom: 8,
  },
  successDescription: {
    fontSize: 14,
    color: '#6e6e73',
    textAlign: 'center',
    marginBottom: 24,
  },
  codeDisplay: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff8e6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#996600',
    lineHeight: 18,
  },
  successActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007aff',
    backgroundColor: '#ffffff',
  },
  copyButtonSuccess: {
    borderColor: '#34c759',
    backgroundColor: '#f0fff4',
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007aff',
  },
  copyButtonTextSuccess: {
    color: '#34c759',
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007aff',
    backgroundColor: '#ffffff',
    marginBottom: 24,
  },
  qrButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007aff',
  },
  codeSummary: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6e6e73',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f1f1f',
  },
  doneButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007aff',
    borderRadius: 8,
    paddingVertical: 14,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default CreateAccessCodeModal;
