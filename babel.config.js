/**
 * Lintnotes
 * - Purpose: Babel configuration for Expo project using preset.
 * - Exports: module.exports returning { presets: ['babel-preset-expo'] }
 * - Major deps: babel-preset-expo
 * - Side effects: None.
 */
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo']
  };
};
