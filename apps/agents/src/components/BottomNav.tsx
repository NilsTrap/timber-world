"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const HOME = { href: "/", label: "Home", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" };
const PRODUCTS = { href: "/catalog", label: "Products", icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" };
const CART = { href: "/cart", label: "Cart", icon: "M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" };
const ORDERS = { href: "/orders", label: "Orders", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6 M9 17h6" };
const ACCOUNT = { href: "/profile", label: "Account", icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" };
const LOGIN = { href: "/login", label: "Log In", icon: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4 M10 17l5-5-5-5 M15 12H3" };

const AUTHED_NAV = [HOME, PRODUCTS, CART, ORDERS, ACCOUNT];
const PUBLIC_NAV = [PRODUCTS, LOGIN];

export function BottomNav({ cartCount = 0, authed = true }: { cartCount?: number; authed?: boolean }) {
  const pathname = usePathname();
  const NAV = authed ? AUTHED_NAV : PUBLIC_NAV;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)" }}>
      <div className="max-w-lg mx-auto flex justify-around py-1.5">
        {NAV.map((item) => {
          const isActive = item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center gap-0.5 px-4 py-1.5 text-[10px] font-medium uppercase tracking-wide transition-colors ${
                isActive ? "text-[var(--forest-green)]" : "text-[var(--charcoal-light)]"
              }`}
            >
              <span className="relative">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d={item.icon} />
                </svg>
                {item.href === "/cart" && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
