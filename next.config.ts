import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Every page in this app renders live rows from Postgres (last scan, shows,
  // artists, alerts), so each one opts into dynamic rendering with
  // `export const dynamic = 'force-dynamic'`. Cache Components forbids that
  // segment config, and nothing here benefits from a cached shell, so it is off.
  cacheComponents: false,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
