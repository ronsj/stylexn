import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TS source; Next must compile them (and run the
  // StyleX Babel plugin over them) rather than treat them as prebuilt deps.
  transpilePackages: ["@stylexn/shared"],
};

export default nextConfig;
