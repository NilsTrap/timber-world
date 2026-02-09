import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use .nosync suffix to prevent iCloud from syncing build folder
  distDir: ".next.nosync",
  // Important for monorepo: transpile workspace packages
  transpilePackages: [
    "@timber/ui",
    "@timber/database",
    "@timber/auth",
    "@timber/config",
    "@timber/utils",
  ],
};

export default nextConfig;
