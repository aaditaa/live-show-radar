import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Every page in this app renders live rows from Postgres (last scan, shows,
  // artists, alerts), so each one opts into dynamic rendering with
  // `export const dynamic = 'force-dynamic'`. Cache Components forbids that
  // segment config, and nothing here benefits from a cached shell, so it is off.
  cacheComponents: false,
  // The Spotify redirect URI must use 127.0.0.1, so dev traffic arrives from
  // that origin rather than localhost. Without this the dev error overlay is
  // blocked and a failed server action shows a blank page.
  allowedDevOrigins: ['127.0.0.1'],
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
