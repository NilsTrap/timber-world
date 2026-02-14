"use server";

import { createCrmClient } from "../lib/supabase";
import { revalidatePath } from "next/cache";
import type {
  DiscoverySearchParams,
  DiscoveryResult,
  CompaniesHouseSearchResult,
  CompaniesHouseOfficer,
  CrmCompany,
  CrmContact,
} from "../types";

// Companies House API base URL
const COMPANIES_HOUSE_API = "https://api.company-information.service.gov.uk";

/**
 * Search Companies House for companies matching a query
 */
export async function searchCompaniesHouse(
  params: DiscoverySearchParams
): Promise<{ success: true; data: DiscoveryResult[] } | { success: false; error: string }> {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;

  if (!apiKey) {
    // Return mock data for development when API key is not set
    console.log("COMPANIES_HOUSE_API_KEY not set, returning mock data");
    return {
      success: true,
      data: getMockCompanies(params.query),
    };
  }

  try {
    // Search for companies
    const searchUrl = `${COMPANIES_HOUSE_API}/search/companies?q=${encodeURIComponent(params.query)}&items_per_page=10`;
    const searchResponse = await fetch(searchUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      },
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error("Companies House search error:", errorText);
      return { success: false, error: `API error: ${searchResponse.status}` };
    }

    const searchData = await searchResponse.json();
    const companies: CompaniesHouseSearchResult[] = searchData.items || [];

    // For each company, get officers (directors)
    const results: DiscoveryResult[] = await Promise.all(
      companies.map(async (company) => {
        const officers = await getCompanyOfficers(company.company_number, apiKey);
        return {
          company: transformCompanyData(company),
          officers: officers.map(transformOfficerData),
        };
      })
    );

    return { success: true, data: results };
  } catch (error) {
    console.error("Error searching Companies House:", error);
    return { success: false, error: "Failed to search Companies House" };
  }
}

/**
 * Get officers (directors) for a company
 */
async function getCompanyOfficers(
  companyNumber: string,
  apiKey: string
): Promise<CompaniesHouseOfficer[]> {
  try {
    const url = `${COMPANIES_HOUSE_API}/company/${companyNumber}/officers`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    // Only return active officers (no resignation date)
    return (data.items || []).filter(
      (officer: CompaniesHouseOfficer) => !officer.resigned_on
    );
  } catch {
    return [];
  }
}

/**
 * Transform Companies House data to our CRM format
 */
function transformCompanyData(ch: CompaniesHouseSearchResult): Partial<CrmCompany> {
  let foundedYear: number | null = null;
  if (ch.date_of_creation) {
    const year = ch.date_of_creation.split("-")[0];
    if (year) {
      foundedYear = parseInt(year, 10);
    }
  }

  return {
    name: ch.title,
    registration_number: ch.company_number,
    country: "UK",
    city: ch.address?.locality || null,
    address: [ch.address?.premises, ch.address?.address_line_1, ch.address?.address_line_2]
      .filter(Boolean)
      .join(", ") || null,
    postal_code: ch.address?.postal_code || null,
    founded_year: foundedYear,
    industry_codes: ch.sic_codes || null,
    source: "companies_house",
    source_url: `https://find-and-update.company-information.service.gov.uk/company/${ch.company_number}`,
    status: "new",
  };
}

/**
 * Transform officer data to contact format
 */
function transformOfficerData(officer: CompaniesHouseOfficer): Partial<CrmContact> {
  // Parse name (usually "LASTNAME, Firstname Middlename")
  const nameParts = officer.name.split(", ");
  const lastName = nameParts[0] || "";
  const firstName = nameParts[1]?.split(" ")[0] || "";

  return {
    first_name: firstName,
    last_name: lastName,
    position: formatOfficerRole(officer.officer_role),
    source: "companies_house",
    consent_status: "pending",
    do_not_contact: false,
    deletion_requested: false,
  };
}

/**
 * Format officer role to readable text
 */
function formatOfficerRole(role: string): string {
  const roleMap: Record<string, string> = {
    director: "Director",
    secretary: "Secretary",
    "corporate-director": "Corporate Director",
    "corporate-secretary": "Corporate Secretary",
    "corporate-nominee-director": "Corporate Nominee Director",
    "corporate-nominee-secretary": "Corporate Nominee Secretary",
    "judicial-factor": "Judicial Factor",
    "llp-member": "LLP Member",
    "llp-designated-member": "LLP Designated Member",
    member: "Member",
    "nominated-member": "Nominated Member",
    nominator: "Nominator",
    "nominee-director": "Nominee Director",
    "nominee-secretary": "Nominee Secretary",
  };
  return roleMap[role] || role;
}

/**
 * Import selected companies and their contacts to database
 */
export async function importDiscoveredCompanies(
  results: DiscoveryResult[]
): Promise<{ success: true; imported: number } | { success: false; error: string }> {
  const supabase = await createCrmClient();
  let importedCount = 0;

  for (const result of results) {
    // Check if company already exists by registration number
    if (result.company.registration_number) {
      const { data: existing } = await supabase
        .from("crm_companies")
        .select("id")
        .eq("registration_number", result.company.registration_number)
        .single();

      if (existing) {
        console.log(`Company ${result.company.name} already exists, skipping`);
        continue;
      }
    }

    // Insert company
    const { data: company, error: companyError } = await supabase
      .from("crm_companies")
      .insert({
        name: result.company.name,
        registration_number: result.company.registration_number,
        website: result.company.website,
        country: result.company.country,
        city: result.company.city,
        address: result.company.address,
        postal_code: result.company.postal_code,
        founded_year: result.company.founded_year,
        industry_codes: result.company.industry_codes,
        source: result.company.source,
        source_url: result.company.source_url,
        status: "new",
      })
      .select()
      .single();

    if (companyError) {
      console.error("Error inserting company:", companyError);
      continue;
    }

    // Insert contacts (officers)
    const companyId = (company as { id: string }).id;
    for (const officer of result.officers) {
      const { error: contactError } = await supabase
        .from("crm_contacts")
        .insert({
          company_id: companyId,
          first_name: officer.first_name,
          last_name: officer.last_name,
          position: officer.position,
          source: officer.source,
          consent_status: "pending",
          do_not_contact: false,
          deletion_requested: false,
        });

      if (contactError) {
        console.error("Error inserting contact:", contactError);
      }
    }

    importedCount++;
  }

  revalidatePath("/admin/crm");
  return { success: true, imported: importedCount };
}

/**
 * Mock data for development when API key is not available
 */
function getMockCompanies(query: string): DiscoveryResult[] {
  const mockCompanies: DiscoveryResult[] = [
    {
      company: {
        name: "STAIRCRAFT LIMITED",
        registration_number: "01234567",
        country: "UK",
        city: "Manchester",
        address: "Unit 5, Industrial Estate",
        postal_code: "M1 2AB",
        founded_year: 1995,
        industry: "Manufacture of wooden stairs and staircases",
        industry_codes: ["16230"],
        source: "companies_house_mock",
        source_url: "https://find-and-update.company-information.service.gov.uk/company/01234567",
        status: "new",
      },
      officers: [
        {
          first_name: "John",
          last_name: "SMITH",
          position: "Director",
          source: "companies_house_mock",
          consent_status: "pending",
        },
        {
          first_name: "Sarah",
          last_name: "JOHNSON",
          position: "Director",
          source: "companies_house_mock",
          consent_status: "pending",
        },
      ],
    },
    {
      company: {
        name: "OAK STAIRCASE DESIGNS LTD",
        registration_number: "07654321",
        country: "UK",
        city: "Birmingham",
        address: "Workshop Lane, Digbeth",
        postal_code: "B5 6DY",
        founded_year: 2008,
        industry: "Bespoke oak staircase manufacturing",
        industry_codes: ["16230", "43320"],
        source: "companies_house_mock",
        source_url: "https://find-and-update.company-information.service.gov.uk/company/07654321",
        status: "new",
      },
      officers: [
        {
          first_name: "Michael",
          last_name: "BROWN",
          position: "Director",
          source: "companies_house_mock",
          consent_status: "pending",
        },
      ],
    },
    {
      company: {
        name: "TIMBER STAIRS UK LIMITED",
        registration_number: "09876543",
        country: "UK",
        city: "Leeds",
        address: "Factory Road",
        postal_code: "LS10 1AB",
        founded_year: 2012,
        industry: "Wooden staircase installation and supply",
        industry_codes: ["16230"],
        source: "companies_house_mock",
        source_url: "https://find-and-update.company-information.service.gov.uk/company/09876543",
        status: "new",
      },
      officers: [
        {
          first_name: "David",
          last_name: "WILLIAMS",
          position: "Director",
          source: "companies_house_mock",
          consent_status: "pending",
        },
        {
          first_name: "Emma",
          last_name: "TAYLOR",
          position: "Secretary",
          source: "companies_house_mock",
          consent_status: "pending",
        },
      ],
    },
    {
      company: {
        name: "HARDWOOD STAIR SOLUTIONS LTD",
        registration_number: "11223344",
        country: "UK",
        city: "Bristol",
        address: "Temple Gate Industrial Park",
        postal_code: "BS1 6QG",
        founded_year: 2015,
        industry: "Hardwood staircase components",
        industry_codes: ["16230", "46730"],
        source: "companies_house_mock",
        source_url: "https://find-and-update.company-information.service.gov.uk/company/11223344",
        status: "new",
      },
      officers: [
        {
          first_name: "James",
          last_name: "WILSON",
          position: "Director",
          source: "companies_house_mock",
          consent_status: "pending",
        },
      ],
    },
    {
      company: {
        name: "BESPOKE STAIRCASES (UK) LTD",
        registration_number: "55667788",
        country: "UK",
        city: "London",
        address: "Carpenters Road",
        postal_code: "E15 2JD",
        founded_year: 2001,
        industry: "Custom staircase design and manufacturing",
        industry_codes: ["16230", "43320"],
        source: "companies_house_mock",
        source_url: "https://find-and-update.company-information.service.gov.uk/company/55667788",
        status: "new",
      },
      officers: [
        {
          first_name: "Robert",
          last_name: "JONES",
          position: "Director",
          source: "companies_house_mock",
          consent_status: "pending",
        },
        {
          first_name: "Lisa",
          last_name: "DAVIS",
          position: "Director",
          source: "companies_house_mock",
          consent_status: "pending",
        },
        {
          first_name: "Peter",
          last_name: "MILLER",
          position: "Secretary",
          source: "companies_house_mock",
          consent_status: "pending",
        },
      ],
    },
  ];

  // Filter by query if provided (simple contains match)
  const lowerQuery = query.toLowerCase();
  return mockCompanies.filter(
    (c) =>
      c.company.name?.toLowerCase().includes(lowerQuery) ||
      c.company.industry?.toLowerCase().includes(lowerQuery) ||
      lowerQuery.includes("stair")
  );
}
