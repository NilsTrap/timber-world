'use server'

import { createServerClient } from '@timber/database/server'
import { loginSchema } from './schemas'
import { redirect } from 'next/navigation'
import type { AdminUser } from '@timber/database/types'

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

export async function signIn(formData: FormData): Promise<ActionResult<void>> {
  const supabase = await createServerClient()

  const result = loginSchema.safeParse({
    email: (formData.get('email') as string)?.trim(),
    password: formData.get('password'),
  })

  if (!result.success) {
    return { success: false, error: 'Invalid input' }
  }

  const { error } = await supabase.auth.signInWithPassword(result.data)

  if (error) {
    return { success: false, error: 'Invalid email or password' }
  }

  // Verify user is in admin_users table
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!adminUser) {
      // Sign out the non-admin user
      await supabase.auth.signOut()
      return { success: false, error: 'You are not authorized to access the admin panel' }
    }
  }

  return { success: true, data: undefined }
}

export async function signOut(): Promise<void> {
  const supabase = await createServerClient()
  const { error } = await supabase.auth.signOut()

  if (error) {
    // Log error but still redirect - user will need to try again
    console.error('Sign out error:', error.message)
  }

  redirect('/admin/login')
}

/**
 * Get authenticated user from Supabase Auth.
 * Use this for auth checks - it validates the token with Supabase.
 */
export async function getUser() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/**
 * Check if the current user is a verified admin.
 * Returns the admin user record if valid, null otherwise.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return adminUser
}
