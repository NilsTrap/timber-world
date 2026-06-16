import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow larger server action payloads for file uploads (default is 1MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
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
  // Fields / Packaging / Pricing Units moved out of the catalogue into the new
  // top-level Settings area (Oscar-integration phase, E1.1). Keep old bookmarks
  // and any external links working. Checked before filesystem routing, so these
  // fire before the catalog `[categoryId]` dynamic segment.
  async redirects() {
    return [
      { source: "/admin/catalog/fields", destination: "/admin/settings/fields", permanent: false },
      { source: "/admin/catalog/packaging", destination: "/admin/settings/packaging", permanent: false },
      { source: "/admin/catalog/pricing-units", destination: "/admin/settings/pricing-units", permanent: false },
    ];
  },
};

export default nextConfig;
