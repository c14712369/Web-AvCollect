import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 與 src/app/api/image-proxy/route.ts 的 ALLOWED_HOSTS 維持一致，避免 SSRF。
    remotePatterns: [
      { protocol: 'https', hostname: 'sixyik.com' },
      { protocol: 'https', hostname: '**.sixyik.com' },
      { protocol: 'https', hostname: 'cdn.jable.tv' },
      { protocol: 'https', hostname: 'jable.tv' },
      { protocol: 'https', hostname: '**.jable.tv' },
      { protocol: 'https', hostname: 'missav.com' },
      { protocol: 'https', hostname: '**.missav.com' },
      { protocol: 'https', hostname: 'fourhoi.com' },
      { protocol: 'https', hostname: '**.fourhoi.com' },
      { protocol: 'https', hostname: 'eightcdn.com' },
      { protocol: 'https', hostname: '**.eightcdn.com' },
    ],
  },
};

export default nextConfig;
