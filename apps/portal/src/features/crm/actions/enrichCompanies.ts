"use server";

import Anthropic from "@anthropic-ai/sdk";
import type { DiscoveryResult, CrmContact } from "../types";
import { formatPhoneInternational } from "../lib/formatPhone";

const anthropic = new Anthropic();

/**
 * Enrich company data using Claude AI with web search
 * Cost: ~$0.01-0.03 per company (web search + tokens)
 */
export async function enrichCompanies(
  results: DiscoveryResult[],
  country: string
): Promise<{
  enrichedResults: DiscoveryResult[];
  searchCount: number;
  estimatedCost: string;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.log("ANTHROPIC_API_KEY not set, returning unenriched results");
    return {
      enrichedResults: results,
      searchCount: 0,
      estimatedCost: "$0.00",
    };
  }

  const enrichedResults: DiscoveryResult[] = [];
  let totalSearches = 0;

  for (const result of results) {
    try {
      const enriched = await enrichSingleCompany(result, country);
      enrichedResults.push(enriched);
      totalSearches += 1; // Each company uses ~1 web search
    } catch (error) {
      console.error(`Error enriching ${result.company.name}:`, error);
      // Keep original result if enrichment fails
      enrichedResults.push(result);
    }
  }

  // Estimate cost: $0.01 per search + ~$0.005 tokens
  const estimatedCost = (totalSearches * 0.015).toFixed(2);

  return {
    enrichedResults,
    searchCount: totalSearches,
    estimatedCost: `$${estimatedCost}`,
  };
}

/**
 * Enrich a single company using Claude with web search
 */
async function enrichSingleCompany(
  result: DiscoveryResult,
  country: string
): Promise<DiscoveryResult> {
  const companyName = result.company.name;
  const website = result.company.website;

  if (!companyName) {
    return result;
  }

  const prompt = `Find contact and business information for this company:

Company: ${companyName}
Website: ${website || "unknown"}
Country: ${country}

Search their website and find:
1. Phone number (main contact/sales)
2. Email address (main contact/info)
3. Physical address
4. Brief description of what they do (1-2 sentences)
5. Key people (names, positions) - up to 3 people

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "phone": "+XX XXX XXX XXXX or null",
  "email": "email@example.com or null",
  "address": "full address or null",
  "city": "city name or null",
  "postal_code": "postal code or null",
  "industry": "brief description of what they do",
  "contacts": [
    {"first_name": "John", "last_name": "Smith", "position": "Director", "email": null, "phone": null}
  ]
}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      tools: [{
        type: "web_search_20250305" as any,
        name: "web_search",
        max_uses: 3,
      }],
      messages: [{
        role: "user",
        content: prompt,
      }],
    }, {
      headers: { "anthropic-beta": "web-search-2025-03-05" },
    });

    // Extract text from response
    let responseText = "";
    for (const block of response.content) {
      if (block.type === "text") {
        responseText += block.text;
      }
    }

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Could not parse enrichment response:", responseText);
      return { ...result, enriched: true };
    }

    const enrichedData = JSON.parse(jsonMatch[0]);

    // Merge enriched data with original
    const enrichedCompany = {
      ...result.company,
      phone: enrichedData.phone ? formatPhoneInternational(enrichedData.phone, country) : result.company.phone,
      email: enrichedData.email || result.company.email,
      address: enrichedData.address || result.company.address,
      city: enrichedData.city || result.company.city,
      postal_code: enrichedData.postal_code || result.company.postal_code,
      industry: enrichedData.industry || result.company.industry,
    };

    // Merge contacts
    const enrichedOfficers: Partial<CrmContact>[] = [
      ...result.officers,
      ...(enrichedData.contacts || []).map((c: any) => ({
        first_name: c.first_name,
        last_name: c.last_name,
        position: c.position,
        email: c.email,
        phone: c.phone ? formatPhoneInternational(c.phone, country) : null,
        source: "ai_enrichment",
        consent_status: "pending" as const,
        do_not_contact: false,
        deletion_requested: false,
      })),
    ];

    return {
      company: enrichedCompany,
      officers: enrichedOfficers,
      enriched: true,
    };
  } catch (error) {
    console.error("Enrichment API error:", error);
    return { ...result, enriched: false };
  }
}
