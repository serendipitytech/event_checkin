/**
 * Lintnotes
 * - Purpose: Modal UI to import attendee rosters from CSV files or Google Sheets and report results.
 * - Exports: RosterImportModal (React component)
 * - Major deps: react-native primitives, @expo/vector-icons/Ionicons, services/rosterImport helpers
 * - Side effects: Initiates file picker and network fetches when user triggers import.
 */
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
import { pickRosterFile, importAttendeesFromCSV, importAttendeesFromGoogleSheet, type ImportResult } from '../services/rosterImport';

type ImportMethod = 'file' | 'sheet';

type RosterImportModalProps = {
  visible: boolean;
  eventId: string;
  onClose: () => void;
  onSuccess: (result: ImportResult) => void;
};

export const RosterImportModal: React.FC<RosterImportModalProps> = ({
  visible,
  eventId,
  onClose,
  onSuccess,
}) => {
  const [importMethod, setImportMethod] = useState<ImportMethod>('file');
  const [sheetUrl, setSheetUrl] = useState('');
  const [skipFirstRow, setSkipFirstRow] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileImport = async () => {
    setLoading(true);
    try {
      const fileResult = await pickRosterFile();
      
      if (fileResult.canceled || !fileResult.assets?.[0]) {
        setLoading(false);
        return;
      }

      const importResult = await importAttendeesFromCSV(fileResult.assets[0].uri, {
        eventId,
        skipFirstRow,
      });

      setResult(importResult);
      if (importResult.success) {
        onSuccess(importResult);
      }
    } catch (error) {
      Alert.alert('Import Failed', error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSheetImport = async () => {
    if (!sheetUrl.trim()) {
      Alert.alert('Error', 'Please enter a Google Sheets URL');
      return;
    }

    setLoading(true);
    try {
      const importResult = await importAttendeesFromGoogleSheet(sheetUrl, {
        eventId,
        skipFirstRow,
      });

      setResult(importResult);
      if (importResult.success) {
        onSuccess(importResult);
      }
    } catch (error) {
      Alert.alert('Import Failed', error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setSheetUrl('');
    onClose();
  };

  const renderImportMethod = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Import Method</Text>
      <View style={styles.methodContainer}>
        <TouchableOpacity
          style={[styles.methodButton, importMethod === 'file' && styles.methodButtonActive]}
          onPress={() => setImportMethod('file')}
        >
          <Ionicons 
            name="document-outline" 
            size={20} 
            color={importMethod === 'file' ? '#007aff' : '#8e8e93'} 
          />
          <Text style={[styles.methodButtonText, importMethod === 'file' && styles.methodButtonTextActive]}>
            CSV File
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.methodButton, importMethod === 'sheet' && styles.methodButtonActive]}
          onPress={() => setImportMethod('sheet')}
        >
          <Ionicons 
            name="grid-outline" 
            size={20} 
            color={importMethod === 'sheet' ? '#007aff' : '#8e8e93'} 
          />
          <Text style={[styles.methodButtonText, importMethod === 'sheet' && styles.methodButtonTextActive]}>
            Google Sheet
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFileImport = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Import CSV File</Text>
      <Text style={styles.sectionDescription}>
        Select a CSV file from your device. The file should contain columns for attendee names, groups, tables, and ticket types.
      </Text>
      <TouchableOpacity
        style={[styles.importButton, loading && styles.importButtonDisabled]}
        onPress={handleFileImport}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <Ionicons name="folder-outline" size={20} color="#ffffff" />
            <Text style={styles.importButtonText}>Choose File</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderSheetImport = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Import Google Sheet</Text>
      <Text style={styles.sectionDescription}>
        Enter the URL of a Google Sheet. Make sure the sheet is publicly accessible or shared with view permissions.
      </Text>
      <TextInput
        style={styles.urlInput}
        value={sheetUrl}
        onChangeText={setSheetUrl}
        placeholder="https://docs.google.com/spreadsheets/d/..."
        placeholderTextColor="#8e8e93"
        autoCapitalize="none"
        autoCorrect={false}
        multiline
      />
      <TouchableOpacity
        style={[styles.importButton, (loading || !sheetUrl.trim()) && styles.importButtonDisabled]}
        onPress={handleSheetImport}
        disabled={loading || !sheetUrl.trim()}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <Ionicons name="cloud-download-outline" size={20} color="#ffffff" />
            <Text style={styles.importButtonText}>Import Sheet</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderOptions = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Import Options</Text>
      <TouchableOpacity
        style={styles.optionRow}
        onPress={() => setSkipFirstRow(!skipFirstRow)}
      >
        <Ionicons 
          name={skipFirstRow ? 'checkbox' : 'square-outline'} 
          size={20} 
          color={skipFirstRow ? '#007aff' : '#8e8e93'} 
        />
        <Text style={styles.optionText}>Skip first row (header row)</Text>
      </TouchableOpacity>
    </View>
  );

  const renderResult = () => {
    if (!result) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Import Result</Text>
        <View style={[styles.resultContainer, result.success ? styles.resultSuccess : styles.resultError]}>
          <Ionicons 
            name={result.success ? 'checkmark-circle' : 'alert-circle'} 
            size={24} 
            color={result.success ? '#27ae60' : '#e74c3c'} 
          />
          <View style={styles.resultContent}>
            <Text style={styles.resultTitle}>
              {result.success ? 'Import Successful' : 'Import Failed'}
            </Text>
            <Text style={styles.resultText}>
              {result.success 
                ? `${result.imported} attendees imported successfully`
                : 'Import failed with errors'
              }
            </Text>
            {result.skipped > 0 && (
              <Text style={styles.resultText}>
                {result.skipped} rows skipped due to errors
              </Text>
            )}
            {result.errors.length > 0 && (
              <View style={styles.errorsContainer}>
                <Text style={styles.errorsTitle}>Errors:</Text>
                {result.errors.map((error, index) => (
                  <Text key={index} style={styles.errorText}>• {error}</Text>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    );
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
          <Text style={styles.title}>Import Roster</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#8e8e93" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderImportMethod()}
          {importMethod === 'file' ? renderFileImport() : renderSheetImport()}
          {renderOptions()}
          {renderResult()}
        </ScrollView>
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
  methodContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e5e7',
    backgroundColor: '#ffffff',
  },
  methodButtonActive: {
    borderColor: '#007aff',
    backgroundColor: '#f0f8ff',
  },
  methodButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8e8e93',
  },
  methodButtonTextActive: {
    color: '#007aff',
  },
  urlInput: {
    borderWidth: 1,
    borderColor: '#e5e5e7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f1f1f',
    backgroundColor: '#ffffff',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007aff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  importButtonDisabled: {
    backgroundColor: '#8e8e93',
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: 14,
    color: '#1f1f1f',
  },
  resultContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  resultSuccess: {
    backgroundColor: '#f0f9f0',
  },
  resultError: {
    backgroundColor: '#fdf2f2',
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f1f1f',
    marginBottom: 4,
  },
  resultText: {
    fontSize: 14,
    color: '#6e6e73',
    marginBottom: 2,
  },
  errorsContainer: {
    marginTop: 8,
  },
  errorsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e74c3c',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#e74c3c',
    marginBottom: 2,
  },
});
