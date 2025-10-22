import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import ActionButton from './ActionButton';
import { generateCheckerLink } from '@/services/checkerLinks';

interface ShareCheckerLinkProps {
  eventId: string;
}

export function ShareCheckerLink({ eventId }: ShareCheckerLinkProps) {
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const result = await generateCheckerLink(eventId);
      
      // Get the base URL depending on environment
      const baseUrl = Platform.select({
        web: typeof window !== 'undefined' ? window.location.origin : '',
        default: 'https://your-app-url.com' // Replace with your actual app URL or deep link
      });
      
      const generatedLink = `${baseUrl}/checker/${result.code}`;
      setLink(generatedLink);
      
      Alert.alert(
        'Link Generated',
        'Your checker link has been generated. Share this with your check-in staff.',
        [{ text: 'OK' }]
      );
    } catch (err) {
      console.error('Failed to generate checker link:', err);
      Alert.alert(
        'Error',
        'Failed to generate checker link. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    
    try {
      await Clipboard.setStringAsync(link);
      Alert.alert('Copied!', 'Link copied to clipboard', [{ text: 'OK' }]);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      Alert.alert('Error', 'Failed to copy link', [{ text: 'OK' }]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Checker Link</Text>
      <Text style={styles.description}>
        Generate a shareable link that allows anyone to check in attendees without logging in. Links expire after 2 days.
      </Text>
      
      <ActionButton
        label={loading ? 'Generating...' : 'Generate New Link'}
        variant="secondary"
        onPress={handleGenerate}
        disabled={loading}
      />

      {link && (
        <View style={styles.linkContainer}>
          <Text style={styles.linkLabel}>Share this link:</Text>
          <View style={styles.linkInputContainer}>
            <TextInput
              value={link}
              editable={false}
              selectTextOnFocus
              multiline
              style={styles.linkInput}
            />
            <TouchableOpacity
              style={styles.copyButton}
              onPress={handleCopy}
              activeOpacity={0.7}
            >
              <Text style={styles.copyButtonText}>Copy</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.expiryNote}>
            ⏱️ This link will expire in 2 days
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f1f1f',
  },
  description: {
    fontSize: 14,
    color: '#555555',
    lineHeight: 20,
  },
  linkContainer: {
    marginTop: 8,
    gap: 8,
  },
  linkLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f1f1f',
  },
  linkInputContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  linkInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d1d6',
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    color: '#1f1f1f',
    backgroundColor: '#f9f9f9',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  copyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  expiryNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
});

