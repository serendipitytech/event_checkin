/**
 * Lintnotes
 * - Purpose: Utilities to pick CSV files, parse rows, map to attendee records, and import from CSV or Google Sheets.
 * - Exports: ImportResult/CSVRow/ImportOptions (types), pickRosterFile, parseCSV, mapCSVRowToAttendee,
 *            importAttendeesFromCSV, importAttendeesFromGoogleSheet, validateCSVFormat
 * - Major deps: expo-document-picker, expo-file-system, services/supabase
 * - Side effects: File access and network fetch when importing; writes to Supabase.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { getSupabaseClient } from './supabase';
import type { Attendee } from './attendees';

export type ImportResult = {
  success: boolean;
  imported: number;
  errors: string[];
  skipped: number;
};

export type CSVRow = {
  [key: string]: string;
};

export type ImportOptions = {
  eventId: string;
  skipFirstRow?: boolean;
  columnMapping?: {
    name?: string;
    group?: string;
    table?: string;
    ticketType?: string;
    notes?: string;
  };
};

const DEFAULT_COLUMN_MAPPING = {
  name: 'name',
  group: 'group',
  table: 'table',
  ticketType: 'ticket',
  notes: 'notes',
};

export const pickRosterFile = async (): Promise<DocumentPicker.DocumentPickerResult> => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      copyToCacheDirectory: true,
    });
    return result;
  } catch (error) {
    console.error('Error picking document:', error);
    throw new Error('Failed to pick document');
  }
};

export const parseCSV = (csvContent: string): CSVRow[] => {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const row: CSVRow = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    rows.push(row);
  }

  return rows;
};

export const mapCSVRowToAttendee = (
  row: CSVRow, 
  mapping: typeof DEFAULT_COLUMN_MAPPING,
  eventId: string
): Partial<Attendee> | null => {
  const name = row[mapping.name]?.trim();
  if (!name) return null;

  return {
    eventId,
    attendeeName: name,
    groupName: row[mapping.group]?.trim() || '',
    tableNumber: row[mapping.table]?.trim() || '',
    ticketType: row[mapping.ticketType]?.trim() || '',
    notes: row[mapping.notes]?.trim() || null,
    checkedIn: false,
    checkedInAt: null,
    checkedInBy: null,
  };
};

export const importAttendeesFromCSV = async (
  fileUri: string,
  options: ImportOptions
): Promise<ImportResult> => {
  const result: ImportResult = {
    success: false,
    imported: 0,
    errors: [],
    skipped: 0,
  };

  try {
    // Read file content
    const fileContent = await FileSystem.readAsStringAsync(fileUri);
    if (!fileContent) {
      result.errors.push('File is empty or could not be read');
      return result;
    }

    // Parse CSV
    const csvRows = parseCSV(fileContent);
    if (csvRows.length === 0) {
      result.errors.push('No data found in CSV file');
      return result;
    }

    // Apply column mapping
    const mapping = { ...DEFAULT_COLUMN_MAPPING, ...options.columnMapping };
    
    // Map rows to attendees
    const attendees: Partial<Attendee>[] = [];
    const errors: string[] = [];

    csvRows.forEach((row, index) => {
      if (options.skipFirstRow && index === 0) return;
      
      const attendee = mapCSVRowToAttendee(row, mapping, options.eventId);
      if (attendee) {
        attendees.push(attendee);
      } else {
        errors.push(`Row ${index + 1}: Missing required name field`);
      }
    });

    if (attendees.length === 0) {
      result.errors.push('No valid attendees found in file');
      return result;
    }

    // Bulk insert to Supabase
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('attendees')
      .insert(attendees.map(attendee => ({
        event_id: attendee.eventId,
        full_name: attendee.attendeeName,
        group_name: attendee.groupName,
        table_number: attendee.tableNumber,
        ticket_type: attendee.ticketType,
        notes: attendee.notes,
        checked_in: attendee.checkedIn,
      })));

    if (error) {
      result.errors.push(`Database error: ${error.message}`);
      return result;
    }

    result.success = true;
    result.imported = attendees.length;
    result.errors = errors;
    result.skipped = errors.length;

  } catch (error) {
    result.errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
};

export const importAttendeesFromGoogleSheet = async (
  sheetUrl: string,
  options: ImportOptions
): Promise<ImportResult> => {
  const result: ImportResult = {
    success: false,
    imported: 0,
    errors: [],
    skipped: 0,
  };

  try {
    // Convert Google Sheets URL to CSV export URL
    const csvUrl = sheetUrl.replace(/\/edit.*$/, '/export?format=csv&gid=0');
    
    // Fetch CSV content
    const response = await fetch(csvUrl);
    if (!response.ok) {
      result.errors.push(`Failed to fetch sheet: ${response.statusText}`);
      return result;
    }

    const csvContent = await response.text();
    if (!csvContent) {
      result.errors.push('Sheet is empty or could not be read');
      return result;
    }

    // Parse and import CSV content
    const csvRows = parseCSV(csvContent);
    if (csvRows.length === 0) {
      result.errors.push('No data found in Google Sheet');
      return result;
    }

    // Apply column mapping
    const mapping = { ...DEFAULT_COLUMN_MAPPING, ...options.columnMapping };
    
    // Map rows to attendees
    const attendees: Partial<Attendee>[] = [];
    const errors: string[] = [];

    csvRows.forEach((row, index) => {
      if (options.skipFirstRow && index === 0) return;
      
      const attendee = mapCSVRowToAttendee(row, mapping, options.eventId);
      if (attendee) {
        attendees.push(attendee);
      } else {
        errors.push(`Row ${index + 1}: Missing required name field`);
      }
    });

    if (attendees.length === 0) {
      result.errors.push('No valid attendees found in sheet');
      return result;
    }

    // Bulk insert to Supabase
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('attendees')
      .insert(attendees.map(attendee => ({
        event_id: attendee.eventId,
        full_name: attendee.attendeeName,
        group_name: attendee.groupName,
        table_number: attendee.tableNumber,
        ticket_type: attendee.ticketType,
        notes: attendee.notes,
        checked_in: attendee.checkedIn,
      })));

    if (error) {
      result.errors.push(`Database error: ${error.message}`);
      return result;
    }

    result.success = true;
    result.imported = attendees.length;
    result.errors = errors;
    result.skipped = errors.length;

  } catch (error) {
    result.errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
};

export const validateCSVFormat = (csvContent: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!csvContent.trim()) {
    errors.push('File is empty');
    return { valid: false, errors };
  }

  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    errors.push('File must contain at least a header row and one data row');
    return { valid: false, errors };
  }

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  if (!headers.some(h => h.toLowerCase().includes('name'))) {
    errors.push('CSV must contain a column with attendee names (look for "name", "full_name", etc.)');
  }

  return { valid: errors.length === 0, errors };
};
