import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A static site: `next build` writes plain HTML/CSS/JS to out/. Trailing
  // slashes make every page a directory index any static server can serve.
  output: "export",
  trailingSlash: true,
  // Workspace packages ship TS source; Next must compile them (and run the
  // StyleX Babel plugin over them) rather than treat them as prebuilt deps.
  transpilePackages: ["@stylexn/shared", "stylexn"],
};

export default nextConfig;
