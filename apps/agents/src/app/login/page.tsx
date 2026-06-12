"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6" style={{ background: "linear-gradient(165deg, #143326, #1B4332 40%, #2D6A4F)" }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/15">
            <svg viewBox="0 0 48 48" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
              <path d="M24 4L14 18h6l-4 12h16l-4-12h6L24 4z"/>
              <line x1="24" y1="30" x2="24" y2="44"/>
              <line x1="20" y1="44" x2="28" y2="44"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Timber Agents</h1>
          <p className="text-white/60 text-sm mt-1">Sign in to place orders and earn commission</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="bg-white rounded-2xl p-6 shadow-xl space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--charcoal)]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--forest-green)]/20 focus:border-[var(--forest-green)]"
              placeholder="agent@example.com"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--charcoal)]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--forest-green)]/20 focus:border-[var(--forest-green)]"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ background: "var(--forest-green)" }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <p className="text-center text-sm text-[var(--charcoal-light)]">
            New here? <a href="/register" className="font-semibold text-[var(--forest-green)]">Apply to become an agent</a>
          </p>
        </form>

        <p className="text-center mt-5">
          <a href="/catalog" className="text-sm font-semibold text-white/80 hover:text-white">← Browse the catalog</a>
        </p>

        <p className="text-center text-white/40 text-xs mt-6">
          © 2026 Timber Agents. Contact your administrator for access.
        </p>
      </div>
    </div>
  );
}
