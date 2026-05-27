import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-16">
      {/* Top header */}
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

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-4">
        {children}
      </main>

      {/* Bottom nav */}
      <BottomNav />
    </div>
  );
}
