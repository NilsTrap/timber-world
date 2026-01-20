/**
 * Supabase Browser Client
 * Use this in Client Components (components with "use client" directive)
 */
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    )
  }

  return { supabaseUrl, supabaseAnonKey }
}

/**
 * Creates a Supabase client for use in the browser/client components
 * This client uses the anonymous key and respects RLS policies
 */
export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig()
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}
