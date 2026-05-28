"use client";

import { useState } from "react";
import Link from "next/link";
import { registerAgent } from "./actions";

export default function RegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!firstName || !lastName || !email || !phone || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    const result = await registerAgent({ firstName, lastName, email, phone, password, website });
    setLoading(false);
    if (result.success) setDone(true);
    else setError(result.error);
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6" style={{ background: "linear-gradient(165deg, #143326, #1B4332 40%, #2D6A4F)" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/15">
            <svg viewBox="0 0 48 48" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
              <path d="M24 4L14 18h6l-4 12h16l-4-12h6L24 4z"/>
              <line x1="24" y1="30" x2="24" y2="44"/>
              <line x1="20" y1="44" x2="28" y2="44"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Become a Timber Agent</h1>
          <p className="text-white/60 text-sm mt-1">Apply for an agent account</p>
        </div>

        {done ? (
          <div className="bg-white rounded-2xl p-6 shadow-xl text-center space-y-3">
            <h2 className="text-lg font-semibold text-[var(--charcoal)]">Application received</h2>
            <p className="text-sm text-[var(--charcoal-light)]">Thanks! Your application is pending approval. We&apos;ll be in touch — you can sign in once approved.</p>
            <Link href="/login" className="inline-block text-sm font-semibold text-[var(--forest-green)]">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-xl space-y-4">
            {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--charcoal)]">First name</label>
                <input className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--charcoal)]">Surname</label>
                <input className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--charcoal)]">Email</label>
              <input type="email" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--charcoal)]">Phone</label>
              <input type="tel" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 …" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--charcoal)]">Password</label>
              <input type="password" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 8 characters" />
            </div>

            {/* Honeypot — visually hidden, off-screen; real users never fill it */}
            <input
              type="text" tabIndex={-1} autoComplete="off" value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="absolute -left-[9999px] w-px h-px opacity-0" aria-hidden="true"
            />

            <button type="submit" disabled={loading} className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--forest-green)" }}>
              {loading ? "Submitting…" : "Apply"}
            </button>

            <p className="text-center text-sm text-[var(--charcoal-light)]">
              Already have an account? <Link href="/login" className="font-semibold text-[var(--forest-green)]">Sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
