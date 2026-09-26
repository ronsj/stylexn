import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // stylexn ships TS source; Next must compile it (and run the StyleX Babel
  // plugin over it) rather than treat it as a prebuilt dep.
  transpilePackages: ["stylexn"],
};

export default nextConfig;
