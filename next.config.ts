import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // The local preview uses this loopback hostname rather than localhost.
  allowedDevOrigins: ["127.0.0.1"],
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
