/**
 * CRM Types
 */

export interface CrmCompany {
  id: string;
  name: string;
  registration_number: string | null;
  website: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  postal_code: string | null;
  founded_year: number | null;
  employees: number | null;
  turnover_eur: number | null;
  industry: string | null;
  industry_codes: string[] | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  source_url: string | null;
  notes: string | null;
  status: CompanyStatus;
  created_at: string;
  updated_at: string;
  // Joined data
  contacts_count?: number;
}

export type CompanyStatus = 'new' | 'researching' | 'contacted' | 'customer' | 'rejected' | 'archived';

export interface CrmContact {
  id: string;
  company_id: string | null;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  source: string | null;
  // GDPR fields
  consent_status: ConsentStatus;
  consent_date: string | null;
  unsubscribe_date: string | null;
  unsubscribe_reason: string | null;
  data_request_date: string | null;
  deletion_requested: boolean;
  last_contacted: string | null;
  do_not_contact: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  company?: CrmCompany;
}

export type ConsentStatus = 'pending' | 'subscribed' | 'unsubscribed';

/**
 * Companies House API Types
 */
export interface CompaniesHouseSearchResult {
  company_number: string;
  title: string;
  company_status: string;
  company_type: string;
  date_of_creation: string;
  address_snippet: string;
  address: {
    premises?: string;
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
  sic_codes?: string[];
}

export interface CompaniesHouseOfficer {
  name: string;
  officer_role: string;
  appointed_on: string;
  resigned_on?: string;
  nationality?: string;
  occupation?: string;
}

export interface DiscoverySearchParams {
  query: string;
  country: string;
}

export interface DiscoveryResult {
  company: Partial<CrmCompany>;
  officers: Partial<CrmContact>[];
}

export type SearchSource = "government" | "web" | "enrichment";

export interface DiscoveryResponse {
  results: DiscoveryResult[];
  searchCount: number;           // API queries made
  totalFound: number;            // Total results from search
  duplicatesFiltered: number;    // Already exist in database
  source: SearchSource;
}
