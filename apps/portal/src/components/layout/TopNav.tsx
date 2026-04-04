import Link from "next/link";
import { User } from "lucide-react";
import { LogoutButton } from "@/features/auth/components";
import { getSession, type UserRole } from "@/lib/auth";
import { NavLink, type IconName } from "./NavLink";

/**
 * Navigation Item Type
 */
interface NavItem {
  href: string;
  label: string;
  iconName: IconName;
}

/**
 * Navigation items for Admin users
 * TODO [i18n]: Replace labels with useTranslations()
 */
const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard" },
  { href: "/inventory", label: "Inventory", iconName: "Package" },
];

/**
 * Navigation items for Organization users
 * TODO [i18n]: Replace labels with useTranslations()
 */
const USER_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard" },
  { href: "/inventory", label: "Inventory", iconName: "Package" },
  { href: "/production", label: "Production", iconName: "Factory" },
  { href: "/history", label: "History", iconName: "History" },
];

/**
 * Get navigation items based on user role
 */
function getNavItems(role: UserRole): NavItem[] {
  return role === "admin" ? ADMIN_NAV_ITEMS : USER_NAV_ITEMS;
}

/**
 * Top Navigation Component
 *
 * Server Component that displays role-appropriate navigation.
 * Fetches session to determine user role and renders corresponding nav items.
 * Uses NavLink client component for active route highlighting.
 */
export async function TopNav() {
  const session = await getSession();
  const navItems = getNavItems(session?.role || "user");

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center px-4">
        <div className="mr-8">
          <Link
            href="/dashboard"
            className="flex items-center space-x-2"
            aria-label="Go to dashboard home"
          >
            <span className="font-semibold text-lg">Timber World</span>
            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
              Portal
            </span>
          </Link>
        </div>

        <nav
          className="flex items-center space-x-6 text-sm font-medium"
          aria-label="Main navigation"
        >
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              iconName={item.iconName}
            />
          ))}
        </nav>

        <div className="ml-auto flex items-center space-x-4">
          <Link
            href="/profile"
            className="flex items-center space-x-2 text-foreground/60 transition-colors hover:text-foreground"
            aria-label="View your profile"
          >
            <User className="h-4 w-4" />
            <span className="text-sm">Profile</span>
          </Link>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
