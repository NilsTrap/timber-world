// Brand configuration for multi-tenant deployment
// Set NEXT_PUBLIC_BRAND environment variable to switch between brands

export type BrandKey = "timber" | "woodgood";

export interface BrandConfig {
  key: BrandKey;
  name: string;
  shortName: string;
  description: string;
  url: string;
  logo: {
    light: string; // Logo for dark backgrounds (white/light colored)
    dark: string; // Logo for light backgrounds (dark colored)
  };
}

const brands: Record<BrandKey, BrandConfig> = {
  timber: {
    key: "timber",
    name: "Timber International",
    shortName: "Timber",
    description:
      "Premium oak panels and wood products - From forest to finished product",
    url: "https://timber-international.com",
    logo: {
      light: "/images/logos/timber-logo.png",
      dark: "/images/logos/timber-logo.png",
    },
  },
  woodgood: {
    key: "woodgood",
    name: "The Wood and Good",
    shortName: "Wood & Good",
    description:
      "Premium oak panels and wood products - From forest to finished product",
    url: "https://thewoodandgood.com",
    logo: {
      light: "/images/logos/woodgood-logo.png",
      dark: "/images/logos/woodgood-logo.png",
    },
  },
};

function getBrandKey(): BrandKey {
  const envBrand = process.env.NEXT_PUBLIC_BRAND;
  if (envBrand && envBrand in brands) {
    return envBrand as BrandKey;
  }
  // Default to timber
  return "timber";
}

export const currentBrand: BrandConfig = brands[getBrandKey()];

export { brands };
