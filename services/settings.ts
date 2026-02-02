/**
 * Lintnotes
 * - Purpose: Persistent app settings and feature flag management with listener pattern for reactive updates.
 * - Exports: FeatureFlags, UndoProtectionLevel, AppSettings (types),
 *            getSettings, updateSettings, addSettingsListener,
 *            getFeatureFlag, setFeatureFlag, getUndoProtectionLevel, setUndoProtectionLevel
 * - Major deps: @react-native-async-storage/async-storage
 * - Side effects: Persists settings to AsyncStorage; stores listeners in module scope.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@checkin_settings';

export type UndoProtectionLevel = 'relaxed' | 'standard' | 'strict';

export type FeatureFlags = {
  undoProtectionLevel: UndoProtectionLevel;
};

export type AppSettings = {
  autoRefreshInterval: number;
  featureFlags: FeatureFlags;
};

const DEFAULT_SETTINGS: AppSettings = {
  autoRefreshInterval: 5000,
  featureFlags: {
    undoProtectionLevel: 'standard',
  },
};

let cachedSettings: AppSettings | null = null;

type SettingsListener = (settings: AppSettings) => void;
const settingsListeners = new Set<SettingsListener>();

const notifyListeners = (settings: AppSettings): void => {
  settingsListeners.forEach((listener) => {
    try {
      listener(settings);
    } catch (err) {
      console.error('Settings listener error:', err);
    }
  });
};

export const addSettingsListener = (listener: SettingsListener): (() => void) => {
  settingsListeners.add(listener);

  if (cachedSettings) {
    listener(cachedSettings);
  } else {
    void getSettings().then((settings) => {
      if (settingsListeners.has(listener)) {
        listener(settings);
      }
    });
  }

  return () => {
    settingsListeners.delete(listener);
  };
};

export const getSettings = async (): Promise<AppSettings> => {
  if (cachedSettings) {
    return cachedSettings;
  }

  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AppSettings>;
      cachedSettings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        featureFlags: {
          ...DEFAULT_SETTINGS.featureFlags,
          ...parsed.featureFlags,
        },
      };
    } else {
      cachedSettings = { ...DEFAULT_SETTINGS };
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
    cachedSettings = { ...DEFAULT_SETTINGS };
  }

  return cachedSettings;
};

export const updateSettings = async (
  updates: Partial<AppSettings>
): Promise<AppSettings> => {
  const current = await getSettings();

  const newSettings: AppSettings = {
    ...current,
    ...updates,
    featureFlags: {
      ...current.featureFlags,
      ...(updates.featureFlags ?? {}),
    },
  };

  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    cachedSettings = newSettings;
    notifyListeners(newSettings);
  } catch (err) {
    console.error('Failed to save settings:', err);
    throw new Error('Unable to save settings');
  }

  return newSettings;
};

export const getFeatureFlag = async <K extends keyof FeatureFlags>(
  flag: K
): Promise<FeatureFlags[K]> => {
  const settings = await getSettings();
  return settings.featureFlags[flag];
};

export const setFeatureFlag = async <K extends keyof FeatureFlags>(
  flag: K,
  value: FeatureFlags[K]
): Promise<void> => {
  const settings = await getSettings();
  await updateSettings({
    featureFlags: {
      ...settings.featureFlags,
      [flag]: value,
    },
  });
};

export const getUndoProtectionLevel = async (): Promise<UndoProtectionLevel> => {
  return getFeatureFlag('undoProtectionLevel');
};

export const setUndoProtectionLevel = async (
  level: UndoProtectionLevel
): Promise<void> => {
  await setFeatureFlag('undoProtectionLevel', level);
};

export const getSettingsSync = (): AppSettings => {
  return cachedSettings ?? DEFAULT_SETTINGS;
};

export const initializeSettings = async (): Promise<AppSettings> => {
  return getSettings();
};
