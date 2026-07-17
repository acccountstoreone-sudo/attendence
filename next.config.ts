import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = (withPWAInit as unknown as (opts: Record<string, unknown>) => (config: NextConfig) => NextConfig)({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  reloadOnOnline: true,
  fallbacks: {
    document: "/~offline",
  },
  workboxOptions: {
    disableDevLogs: true,
    navigateFallbackDenylist: [
      /^\/api\//,
      /^\/login/,
      /^\/register/,
      /^\/admin/,
      /^\/branch-manager/,
      /^\/employee/,
      /\?.*redirectTo=/,
    ],
  },
});

const nextConfig: import('next').NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
    optimizePackageImports: ['lucide-react', 'recharts', '@react-three/drei'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  compress: true,
  turbopack: {},
};

export default withPWA(nextConfig);
