import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Allow local previews from loopback, Ethernet, and the Windows Wi-Fi hotspot.
  allowedDevOrigins: ["127.0.0.1", "10.91.0.228", "192.168.137.1"],
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    agentUpgrade: "security",
  },
};

export default nextConfig;
