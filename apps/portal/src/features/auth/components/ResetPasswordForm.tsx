"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@timber/ui";
import { createClient } from "@/lib/supabase/client";
import { markSessionVerified } from "@/components/SessionVerificationGuard";
import { updateRecoveredPassword } from "../actions/passwordRecovery";

type State = "loading" | "ready" | "invalid";

export function ResetPasswordForm() {
  const router = useRouter(); const [state, setState] = useState<State>("loading");
  const tokenProcessingStarted = useRef(false);
  const [password, setPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null); const [isPending, setIsPending] = useState(false);

  useEffect(() => { if (tokenProcessingStarted.current) return; tokenProcessingStarted.current = true; void (async () => {
    const supabase = createClient(); const params = new URLSearchParams(window.location.search); const code = params.get("code");
    if (code) { const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code); if (exchangeError) { setState("invalid"); return; } window.history.replaceState(null, "", window.location.pathname); setState("ready"); return; }
    const hash = new URLSearchParams(window.location.hash.slice(1)); const accessToken = hash.get("access_token");
    if (!accessToken || hash.get("type") !== "recovery") { setState("invalid"); return; }
    const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: hash.get("refresh_token") ?? "" });
    if (sessionError) { setState("invalid"); return; } window.history.replaceState(null, "", window.location.pathname); setState("ready");
  })(); }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    setIsPending(true); const result = await updateRecoveredPassword(password); setIsPending(false);
    if (!result.success) { setError(result.error); return; }
    markSessionVerified(); router.push(result.data.redirectTo); router.refresh();
  }

  if (state === "loading") return <p role="status" className="text-center text-sm text-muted-foreground">Verifying recovery link...</p>;
  if (state === "invalid") return <div className="space-y-4 text-center"><p role="alert" className="text-sm text-destructive">This recovery link has expired or is invalid.</p><Button asChild variant="outline"><Link href="/forgot-password">Request a new link</Link></Button></div>;
  return <form className="space-y-4" onSubmit={submit}>
    <div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={isPending} /></div>
    <div className="space-y-2"><Label htmlFor="confirm-new-password">Confirm new password</Label><Input id="confirm-new-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={isPending} />{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>
    <Button className="w-full" disabled={isPending} type="submit">{isPending ? "Updating..." : "Set new password"}</Button>
  </form>;
}
