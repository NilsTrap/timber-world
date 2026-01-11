import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/actions/auth'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

// Force dynamic rendering - this layout requires authentication
export const dynamic = 'force-dynamic'

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const adminUser = await getAdminUser()

  // Verify user is authenticated AND is in admin_users table
  if (!adminUser) {
    redirect('/admin/login')
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <AdminSidebar
        userName={adminUser.name || adminUser.email?.split('@')[0]}
        userEmail={adminUser.email}
      />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
