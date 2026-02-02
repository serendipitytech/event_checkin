/**
 * Lintnotes
 * - Purpose: React hooks for accessing app settings and feature flags with reactive updates.
 * - Exports: useSettings (hook), useFeatureFlag (hook), useUndoProtectionLevel (hook)
 * - Major deps: React useState/useEffect, services/settings
 * - Side effects: Subscribes to settings changes via listener pattern.
 */
import { useEffect, useState } from 'react';
import {
  addSettingsListener,
  getSettingsSync,
  type AppSettings,
  type FeatureFlags,
  type UndoProtectionLevel,
} from '../services/settings';

export const useSettings = (): AppSettings => {
  const [settings, setSettings] = useState<AppSettings>(getSettingsSync);

  useEffect(() => {
    const unsubscribe = addSettingsListener((newSettings) => {
      setSettings(newSettings);
    });

    return unsubscribe;
  }, []);

  return settings;
};

export const useFeatureFlag = <K extends keyof FeatureFlags>(
  flag: K
): FeatureFlags[K] => {
  const settings = useSettings();
  return settings.featureFlags[flag];
};

export const useUndoProtectionLevel = (): UndoProtectionLevel => {
  return useFeatureFlag('undoProtectionLevel');
};
