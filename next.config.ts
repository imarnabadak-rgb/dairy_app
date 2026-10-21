import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow other devices on the LAN to load dev-only assets (HMR, etc.).
  // Hostnames only - no scheme, port or path. Development only.
  // `*` matches exactly one hostname label (e.g. 192.168.1.* = 192.168.1.x).
  allowedDevOrigins: ['192.168.*.*', '172.20.10.*', '10.*.*.*'],
};

export default nextConfig;
