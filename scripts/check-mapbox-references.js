/* eslint-disable no-console */
const { execSync } = require('child_process');

const PATTERN = 'mapbox|EXPO_PUBLIC_MAPBOX|friends_mapbox|supportsNativeMapbox';
const PATHS = ['src', 'supabase', '.env.example', 'app.config.ts', 'README.md'];

function run() {
  try {
    execSync(`rg -n "${PATTERN}" ${PATHS.join(' ')}`, { stdio: 'pipe' });
    console.error('Mapbox references detected. Remove all Mapbox references before release.');
    process.exit(1);
  } catch (error) {
    if (error && typeof error.status === 'number' && error.status === 1) {
      console.log('Mapbox reference check passed.');
      process.exit(0);
    }

    console.error('Unable to run Mapbox reference check:', error?.message || error);
    process.exit(1);
  }
}

run();
