"use server";

import type { DiscoverySearchParams, DiscoveryResult } from "../types";

const COUNTRY_NAMES: Record<string, string> = {
  UK: "United Kingdom",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  NL: "Netherlands",
  BE: "Belgium",
  IE: "Ireland",
  DE: "Germany",
};

// Map our country codes to Brave's 2-letter country codes
const BRAVE_COUNTRY_CODES: Record<string, string> = {
  UK: "GB",
  SE: "SE",
  NO: "NO",
  DK: "DK",
  FI: "FI",
  NL: "NL",
  BE: "BE",
  IE: "IE",
  DE: "DE",
};

/**
 * Search the web for companies matching the query
 * Uses Brave Search API for web search results
 * Free tier: 2,000 queries/month, then $5/1000
 */
export async function searchWeb(
  params: DiscoverySearchParams
): Promise<{ success: true; data: DiscoveryResult[] } | { success: false; error: string }> {
  const apiKey = process.env.BRAVE_API_KEY;
  const countryName = COUNTRY_NAMES[params.country] || params.country;

  // Build search query with country context
  const searchQuery = `${params.query} ${countryName} company`;

  if (!apiKey) {
    // For development/demo, use mock data based on search terms
    console.log("BRAVE_API_KEY not set, returning demo web results");
    return {
      success: true,
      data: getDemoWebResults(params.query, params.country),
    };
  }

  try {
    // Using Brave Search API
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", searchQuery);
    url.searchParams.set("count", "10");
    url.searchParams.set("country", BRAVE_COUNTRY_CODES[params.country] || "GB");
    url.searchParams.set("safesearch", "moderate");

    const response = await fetch(url.toString(), {
      headers: {
        "X-Subscription-Token": apiKey,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Brave Search API error:", errorText);
      return { success: false, error: `Search API error: ${response.status}` };
    }

    const data = await response.json();
    const results = parseBraveResults(data, params.country);

    return { success: true, data: results };
  } catch (error) {
    console.error("Error searching web:", error);
    return { success: false, error: "Failed to search the web" };
  }
}

/**
 * Parse Brave Search API results into our discovery format
 */
function parseBraveResults(data: Record<string, unknown>, country: string): DiscoveryResult[] {
  const webResults = ((data.web as Record<string, unknown>)?.results || []) as Array<{
    title: string;
    url: string;
    description?: string;
  }>;

  return webResults
    .filter((result) => {
      // Filter out non-company results (social media, directories, etc.)
      const url = result.url.toLowerCase();
      return (
        !url.includes("linkedin.com") &&
        !url.includes("facebook.com") &&
        !url.includes("twitter.com") &&
        !url.includes("wikipedia.org") &&
        !url.includes("youtube.com")
      );
    })
    .slice(0, 10)
    .map((result) => ({
      company: {
        name: extractCompanyName(result.title),
        website: result.url,
        country: country,
        industry: result.description || null,
        source: "web_search",
        source_url: result.url,
        status: "new" as const,
      },
      officers: [],
    }));
}

/**
 * Extract company name from search result title
 */
function extractCompanyName(title: string): string {
  // Remove common suffixes like " | Home", " - Official Site", etc.
  return title
    .replace(/\s*[\|\-–—]\s*.*(home|official|website|site|page).*$/i, "")
    .replace(/\s*[\|\-–—]\s*$/, "")
    .trim();
}

/**
 * Demo web search results for development
 * Returns realistic-looking results based on search terms
 */
function getDemoWebResults(query: string, country: string): DiscoveryResult[] {
  const lowerQuery = query.toLowerCase();
  const countryName = COUNTRY_NAMES[country] || country;

  // Generate relevant demo results based on query
  const baseResults: DiscoveryResult[] = [];

  if (lowerQuery.includes("stair") || lowerQuery.includes("oak")) {
    baseResults.push(
      {
        company: {
          name: "British Staircases Ltd",
          website: "https://www.britishstaircases.co.uk",
          country: country,
          city: "Birmingham",
          industry: "Bespoke wooden staircase manufacturer specializing in oak and hardwood designs",
          source: "web_search",
          source_url: "https://www.britishstaircases.co.uk",
          status: "new",
        },
        officers: [],
      },
      {
        company: {
          name: "Oak Stair Company",
          website: "https://www.oakstaircompany.com",
          country: country,
          city: "Manchester",
          industry: "Premium oak staircases, handrails and balustrades for residential and commercial projects",
          source: "web_search",
          source_url: "https://www.oakstaircompany.com",
          status: "new",
        },
        officers: [],
      },
      {
        company: {
          name: "Heritage Stairs & Joinery",
          website: "https://www.heritagestairs.co.uk",
          country: country,
          city: "London",
          industry: "Traditional craftsmanship in wooden staircases, restoration and new builds",
          source: "web_search",
          source_url: "https://www.heritagestairs.co.uk",
          status: "new",
        },
        officers: [],
      }
    );
  }

  if (lowerQuery.includes("furniture") || lowerQuery.includes("table")) {
    baseResults.push(
      {
        company: {
          name: `${countryName} Fine Furniture`,
          website: `https://www.${country.toLowerCase()}finefurniture.com`,
          country: country,
          city: country === "UK" ? "Leeds" : "Stockholm",
          industry: "Handcrafted solid wood furniture, dining tables and bespoke pieces",
          source: "web_search",
          source_url: `https://www.${country.toLowerCase()}finefurniture.com`,
          status: "new",
        },
        officers: [],
      },
      {
        company: {
          name: "Artisan Woodworks",
          website: "https://www.artisanwoodworks.eu",
          country: country,
          city: country === "UK" ? "Bristol" : "Copenhagen",
          industry: "Contemporary wooden furniture design and manufacturing",
          source: "web_search",
          source_url: "https://www.artisanwoodworks.eu",
          status: "new",
        },
        officers: [],
      }
    );
  }

  if (lowerQuery.includes("timber") || lowerQuery.includes("wood")) {
    baseResults.push(
      {
        company: {
          name: "Nordic Timber Supplies",
          website: "https://www.nordictimber.com",
          country: country,
          city: country === "SE" ? "Gothenburg" : "Newcastle",
          industry: "Wholesale timber supplier, hardwoods and softwoods for construction and joinery",
          source: "web_search",
          source_url: "https://www.nordictimber.com",
          status: "new",
        },
        officers: [],
      },
      {
        company: {
          name: "European Hardwoods Trading",
          website: "https://www.europeanhardwoods.eu",
          country: country,
          city: country === "DE" ? "Hamburg" : "Southampton",
          industry: "Import and distribution of European and tropical hardwoods",
          source: "web_search",
          source_url: "https://www.europeanhardwoods.eu",
          status: "new",
        },
        officers: [],
      }
    );
  }

  // If no specific matches, return generic results
  if (baseResults.length === 0) {
    baseResults.push(
      {
        company: {
          name: `${query} Specialists ${countryName}`,
          website: `https://www.${query.toLowerCase().replace(/\s+/g, "")}.com`,
          country: country,
          industry: `${query} - specialist supplier and manufacturer`,
          source: "web_search",
          source_url: `https://www.${query.toLowerCase().replace(/\s+/g, "")}.com`,
          status: "new",
        },
        officers: [],
      }
    );
  }

  return baseResults;
}
