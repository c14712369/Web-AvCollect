import type { NextConfig } from "next";
import { IMAGE_HOSTS } from "./src/lib/image-proxy";

const nextConfig: NextConfig = {
  images: {
    // 由 src/lib/image-proxy.ts 的白名單產生（與 /api/image-proxy 同一份），禁止萬用 `**`。
    remotePatterns: IMAGE_HOSTS.flatMap((hostname) => [
      { protocol: 'https' as const, hostname },
      { protocol: 'https' as const, hostname: `**.${hostname}` },
    ]),
  },
};

export default nextConfig;
