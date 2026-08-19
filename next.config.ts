import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  // Disable PWA in development to avoid service worker interfering with HMR
  disable: process.env.NODE_ENV === "development",
  // Serve the offline fallback page from app/~offline/page.tsx
  fallbacks: {
    document: "/~offline",
  },
  // Do not precache large model files stored in /public/models
  publicExcludes: ["!models/**/*"],
  workboxOptions: {
    // Increase the precache size limit for face-api model files
    maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB
  },
});

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
    optimizePackageImports: ["lucide-react", "recharts", "@react-three/drei"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  compress: true,
};

export default withPWA(nextConfig);
