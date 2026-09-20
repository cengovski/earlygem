import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: false },
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
};

export default nextConfig;
