module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      [
        'module-resolver',
        {
          root: ['./'],
          extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@screens': './src/screens',
            '@theme': './src/theme',
            '@utils': './src/utils',
            '@hooks': './src/hooks',
            '@navigation': './src/navigation',
            '@types': './src/types',
          },
        },
      ],
    ],
  };
};
