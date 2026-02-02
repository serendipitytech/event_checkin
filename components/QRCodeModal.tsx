/**
 * Lintnotes
 * - Purpose: Modal to display QR code for an event access code with sharing options.
 * - Exports: QRCodeModal (React component)
 * - Major deps: react-native primitives, react-native-qrcode-svg, expo-clipboard, expo-sharing
 * - Side effects: Copies to clipboard, opens share sheet.
 */
import React, { useState, useEffect } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';
import {
  generateAccessCodeLink,
  getShareMessage,
} from '../services/qrCodeGeneration';
import { formatCodeForDisplay } from '../services/codeManagement';
import { useDeviceLayout } from '../hooks/useDeviceLayout';

type QRCodeModalProps = {
  visible: boolean;
  code: string;
  eventId: string;
  eventName?: string;
  onClose: () => void;
};

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  visible,
  code,
  eventId,
  eventName,
  onClose,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const { isTablet } = useDeviceLayout();

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

  const displayCode = formatCodeForDisplay(code);
  const deepLink = generateAccessCodeLink(code, eventId);

  const handleCopyCode = async () => {
    try {
      await Clipboard.setStringAsync(displayCode);
      setCopiedCode(true);
    } catch {
      Alert.alert('Error', 'Failed to copy code to clipboard');
    }
  };

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(deepLink);
      setCopiedLink(true);
    } catch {
      Alert.alert('Error', 'Failed to copy link to clipboard');
    }
  };

  const handleShare = async () => {
    const sharingAvailable = await Sharing.isAvailableAsync();

    if (sharingAvailable) {
      try {
        const message = getShareMessage(code, eventId, eventName);
        await Clipboard.setStringAsync(message);
        Alert.alert(
          'Ready to Share',
          'The access code and link have been copied to your clipboard. You can paste it in any messaging app.'
        );
      } catch {
        Alert.alert('Error', 'Failed to prepare share content');
      }
    } else {
      Alert.alert('Sharing Not Available', 'Sharing is not supported on this device.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, isTablet && styles.modalTablet]}>
          <View style={styles.header}>
            <Text style={styles.title}>Share Access Code</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#8e8e93" />
            </TouchableOpacity>
          </View>

          {eventName && (
            <Text style={styles.eventName}>{eventName}</Text>
          )}

          <View style={styles.qrContainer}>
            <QRCode
              value={deepLink}
              size={200}
              backgroundColor="#ffffff"
              color="#1f1f1f"
            />
          </View>

          <View style={styles.codeDisplay}>
            <Text style={styles.codeLabel}>Access Code</Text>
            <Text style={styles.codeText}>{displayCode}</Text>
          </View>

          <Text style={styles.instructions}>
            Scan this QR code with a camera or enter the code manually to get access.
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, copiedCode && styles.actionButtonSuccess]}
              onPress={handleCopyCode}
            >
              <Ionicons
                name={copiedCode ? 'checkmark' : 'copy-outline'}
                size={18}
                color={copiedCode ? '#34c759' : '#007aff'}
              />
              <Text style={[styles.actionButtonText, copiedCode && styles.actionButtonTextSuccess]}>
                {copiedCode ? 'Copied!' : 'Copy Code'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, copiedLink && styles.actionButtonSuccess]}
              onPress={handleCopyLink}
            >
              <Ionicons
                name={copiedLink ? 'checkmark' : 'link-outline'}
                size={18}
                color={copiedLink ? '#34c759' : '#007aff'}
              />
              <Text style={[styles.actionButtonText, copiedLink && styles.actionButtonTextSuccess]}>
                {copiedLink ? 'Copied!' : 'Copy Link'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color="#ffffff" />
            <Text style={styles.shareButtonText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalTablet: {
    maxWidth: 400,
    padding: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f1f1f',
  },
  closeButton: {
    padding: 4,
  },
  eventName: {
    fontSize: 14,
    color: '#8e8e93',
    marginBottom: 20,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  codeDisplay: {
    alignItems: 'center',
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 12,
    color: '#8e8e93',
    marginBottom: 4,
  },
  codeText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f1f1f',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  instructions: {
    fontSize: 13,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007aff',
    backgroundColor: '#ffffff',
  },
  actionButtonSuccess: {
    borderColor: '#34c759',
    backgroundColor: '#f0fff4',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007aff',
  },
  actionButtonTextSuccess: {
    color: '#34c759',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    backgroundColor: '#007aff',
    borderRadius: 8,
    paddingVertical: 14,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default QRCodeModal;
