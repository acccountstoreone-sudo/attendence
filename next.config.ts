import type { NextConfig } from "next";

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

export default nextConfig;
