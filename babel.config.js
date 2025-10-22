/**
 * Lintnotes
 * - Purpose: Babel configuration for Expo project using preset with module resolver for @ alias.
 * - Exports: module.exports returning { presets: ['babel-preset-expo'], plugins: [module-resolver] }
 * - Major deps: babel-preset-expo, babel-plugin-module-resolver
 * - Side effects: Configures @ alias to resolve to project root.
 */
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': './',
          },
        },
      ],
    ],
  };
};
