import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { LogoutButton } from "@/components/LogoutButton";
import { createClient } from "@/lib/supabase/server";
import { getCart } from "./cart/actions";

const Logo = () => (
  <svg viewBox="0 0 48 48" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M24 4L14 18h6l-4 12h16l-4-12h6L24 4z"/>
    <line x1="24" y1="30" x2="24" y2="44"/>
    <line x1="20" y1="44" x2="28" y2="44"/>
  </svg>
);

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // ─── Public (signed-out) mode: browse the catalog + prices, no ordering ───
  if (!user) {
    return (
      <div className="min-h-dvh pb-16">
        <header className="sticky top-0 z-50 px-4 py-3 shadow-sm" style={{ background: "var(--forest-green)" }}>
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <Link href="/catalog" className="flex items-center gap-2 text-white">
              <Logo />
              <span className="font-bold text-base">Timber Agents</span>
            </Link>
            <Link href="/login" className="text-white text-sm font-semibold rounded-lg px-3 py-1.5 bg-white/10 border border-white/20">
              Log in
            </Link>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-4">{children}</main>
        <BottomNav authed={false} />
      </div>
    );
  }

  const { data: agent } = await (supabase as any)
    .from("agent_users")
    .select("application_status, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const approved = agent?.application_status === "approved" && agent?.is_active === true;

  if (!approved) {
    return (
      <div className="min-h-dvh flex flex-col">
        <header className="sticky top-0 z-50 px-4 py-3 shadow-sm" style={{ background: "var(--forest-green)" }}>
          <div className="max-w-lg mx-auto flex items-center gap-2 text-white">
            <svg viewBox="0 0 48 48" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
              <path d="M24 4L14 18h6l-4 12h16l-4-12h6L24 4z"/>
              <line x1="24" y1="30" x2="24" y2="44"/>
              <line x1="20" y1="44" x2="28" y2="44"/>
            </svg>
            <span className="font-bold text-base">Timber Agents</span>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-sm text-center space-y-3">
            <h1 className="text-xl font-bold text-[var(--charcoal)]">Application pending</h1>
            <p className="text-sm text-[var(--charcoal-light)]">Your agent account is awaiting approval. You&apos;ll get access to the catalog and pricing once an administrator approves you.</p>
            <div className="pt-2"><LogoutButton /></div>
          </div>
        </main>
      </div>
    );
  }

  const cartResult = await getCart();
  const cartCount = cartResult.success && cartResult.data ? cartResult.data.items.length : 0;

  return (
    <div className="min-h-dvh pb-16">
      <header className="sticky top-0 z-50 px-4 py-3 shadow-sm" style={{ background: "var(--forest-green)" }}>
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white">
            <svg viewBox="0 0 48 48" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
              <path d="M24 4L14 18h6l-4 12h16l-4-12h6L24 4z"/>
              <line x1="24" y1="30" x2="24" y2="44"/>
              <line x1="20" y1="44" x2="28" y2="44"/>
            </svg>
            <span className="font-bold text-base">Timber Agents</span>
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {children}
      </main>

      <BottomNav cartCount={cartCount} />
    </div>
  );
}
