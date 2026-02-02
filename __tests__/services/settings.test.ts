/**
 * Unit tests for services/settings.ts
 * Tests feature flag infrastructure and settings persistence
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAsyncStorageMock } from '../setup';

const SETTINGS_KEY = '@checkin_settings';

describe('services/settings', () => {
  // Reset module state before each test
  let settingsModule: typeof import('../../services/settings');

  beforeEach(() => {
    clearAsyncStorageMock();
    jest.clearAllMocks();
    jest.resetModules();
    settingsModule = require('../../services/settings');
  });

  describe('getSettings', () => {
    it('returns default settings when no stored settings exist', async () => {
      const settings = await settingsModule.getSettings();

      expect(settings).toEqual({
        autoRefreshInterval: 5000,
        featureFlags: {
          undoProtectionLevel: 'standard',
        },
      });
    });

    it('loads settings from AsyncStorage', async () => {
      // Pre-populate storage
      const stored = {
        autoRefreshInterval: 10000,
        featureFlags: {
          undoProtectionLevel: 'relaxed',
        },
      };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(stored));

      const settings = await settingsModule.getSettings();

      expect(settings.autoRefreshInterval).toBe(10000);
      expect(settings.featureFlags.undoProtectionLevel).toBe('relaxed');
    });

    it('merges partial stored settings with defaults', async () => {
      const partial = {
        autoRefreshInterval: 15000,
        // featureFlags missing
      };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(partial));

      const settings = await settingsModule.getSettings();

      expect(settings.autoRefreshInterval).toBe(15000);
      expect(settings.featureFlags.undoProtectionLevel).toBe('standard'); // default
    });

    it('handles partial featureFlags', async () => {
      const partial = {
        autoRefreshInterval: 5000,
        featureFlags: {
          // undoProtectionLevel missing
        },
      };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(partial));

      const settings = await settingsModule.getSettings();

      expect(settings.featureFlags.undoProtectionLevel).toBe('standard'); // default
    });

    it('caches settings after first load', async () => {
      const firstResult = await settingsModule.getSettings();
      const secondResult = await settingsModule.getSettings();
      const thirdResult = await settingsModule.getSettings();

      // All calls should return the same object reference (cached)
      expect(firstResult).toBe(secondResult);
      expect(secondResult).toBe(thirdResult);
    });
  });

  describe('updateSettings', () => {
    it('saves updated settings to AsyncStorage', async () => {
      await settingsModule.getSettings(); // Initialize
      const updated = await settingsModule.updateSettings({ autoRefreshInterval: 30000 });

      expect(updated.autoRefreshInterval).toBe(30000);

      // Verify persisted
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      expect(stored).toContain('"autoRefreshInterval":30000');
    });

    it('merges feature flags without overwriting other settings', async () => {
      const initial = {
        autoRefreshInterval: 5000,
        featureFlags: {
          undoProtectionLevel: 'standard',
        },
      };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(initial));

      await settingsModule.getSettings();
      const updated = await settingsModule.updateSettings({
        featureFlags: {
          undoProtectionLevel: 'relaxed',
        },
      });

      expect(updated.featureFlags.undoProtectionLevel).toBe('relaxed');
      expect(updated.autoRefreshInterval).toBe(5000); // unchanged
    });

    it('preserves feature flags when updating other settings', async () => {
      const initial = {
        autoRefreshInterval: 10000,
        featureFlags: {
          undoProtectionLevel: 'strict',
        },
      };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(initial));

      await settingsModule.getSettings();
      const updated = await settingsModule.updateSettings({
        autoRefreshInterval: 20000,
      });

      expect(updated.autoRefreshInterval).toBe(20000);
      expect(updated.featureFlags.undoProtectionLevel).toBe('strict'); // preserved
    });
  });

  describe('addSettingsListener', () => {
    it('immediately calls listener with current settings', async () => {
      await settingsModule.getSettings(); // Initialize cache

      const listener = jest.fn();
      settingsModule.addSettingsListener(listener);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          featureFlags: expect.objectContaining({
            undoProtectionLevel: 'standard',
          }),
        })
      );
    });

    it('calls listener when settings are updated', async () => {
      await settingsModule.getSettings();

      const listener = jest.fn();
      settingsModule.addSettingsListener(listener);
      listener.mockClear();

      await settingsModule.updateSettings({ autoRefreshInterval: 20000 });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          autoRefreshInterval: 20000,
        })
      );
    });

    it('returns unsubscribe function that stops notifications', async () => {
      await settingsModule.getSettings();

      const listener = jest.fn();
      const unsubscribe = settingsModule.addSettingsListener(listener);
      listener.mockClear();

      unsubscribe();

      await settingsModule.updateSettings({ autoRefreshInterval: 25000 });

      expect(listener).not.toHaveBeenCalled();
    });

    it('notifies multiple listeners', async () => {
      await settingsModule.getSettings();

      const listener1 = jest.fn();
      const listener2 = jest.fn();
      settingsModule.addSettingsListener(listener1);
      settingsModule.addSettingsListener(listener2);
      listener1.mockClear();
      listener2.mockClear();

      await settingsModule.updateSettings({ autoRefreshInterval: 15000 });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('getFeatureFlag / setFeatureFlag', () => {
    it('gets specific feature flag value', async () => {
      const stored = {
        autoRefreshInterval: 5000,
        featureFlags: {
          undoProtectionLevel: 'relaxed',
        },
      };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(stored));

      const level = await settingsModule.getFeatureFlag('undoProtectionLevel');

      expect(level).toBe('relaxed');
    });

    it('sets specific feature flag value', async () => {
      await settingsModule.getSettings();
      await settingsModule.setFeatureFlag('undoProtectionLevel', 'strict');
      const level = await settingsModule.getFeatureFlag('undoProtectionLevel');

      expect(level).toBe('strict');
    });
  });

  describe('getUndoProtectionLevel / setUndoProtectionLevel', () => {
    it('returns default protection level', async () => {
      const level = await settingsModule.getUndoProtectionLevel();
      expect(level).toBe('standard');
    });

    it('gets stored protection level', async () => {
      const stored = {
        autoRefreshInterval: 5000,
        featureFlags: {
          undoProtectionLevel: 'relaxed',
        },
      };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(stored));

      const level = await settingsModule.getUndoProtectionLevel();
      expect(level).toBe('relaxed');
    });

    it('sets and persists protection level', async () => {
      await settingsModule.getSettings();
      await settingsModule.setUndoProtectionLevel('relaxed');

      const level = await settingsModule.getUndoProtectionLevel();
      expect(level).toBe('relaxed');

      // Verify persisted
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      expect(stored).toContain('"undoProtectionLevel":"relaxed"');
    });
  });

  describe('getSettingsSync', () => {
    it('returns cached settings synchronously', async () => {
      const stored = {
        autoRefreshInterval: 7500,
        featureFlags: {
          undoProtectionLevel: 'strict',
        },
      };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(stored));

      await settingsModule.getSettings(); // Populate cache
      const settings = settingsModule.getSettingsSync();

      expect(settings.autoRefreshInterval).toBe(7500);
      expect(settings.featureFlags.undoProtectionLevel).toBe('strict');
    });

    it('returns defaults if cache not populated', () => {
      const settings = settingsModule.getSettingsSync();

      expect(settings.featureFlags.undoProtectionLevel).toBe('standard');
      expect(settings.autoRefreshInterval).toBe(5000);
    });
  });

  describe('initializeSettings', () => {
    it('loads and returns settings', async () => {
      const stored = {
        autoRefreshInterval: 12000,
        featureFlags: {
          undoProtectionLevel: 'relaxed',
        },
      };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(stored));

      const settings = await settingsModule.initializeSettings();

      expect(settings.autoRefreshInterval).toBe(12000);
      expect(settings.featureFlags.undoProtectionLevel).toBe('relaxed');
    });
  });

  describe('valid undo protection levels', () => {
    it.each(['relaxed', 'standard', 'strict'] as const)(
      'accepts %s as valid undo protection level',
      async (level) => {
        await settingsModule.getSettings();
        await settingsModule.setUndoProtectionLevel(level);
        const result = await settingsModule.getUndoProtectionLevel();

        expect(result).toBe(level);
      }
    );
  });
});
