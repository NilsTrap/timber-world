import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use .nosync suffix locally to prevent iCloud sync, but use .next on Vercel
  distDir: process.env.VERCEL ? ".next" : ".next.nosync",
  // Important for monorepo: transpile workspace packages
  transpilePackages: [
    "@timber/ui",
    "@timber/database",
    "@timber/auth",
    "@timber/config",
    "@timber/utils",
  ],
  // Allow images from Supabase storage
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "psmramegggsciirwldjz.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
