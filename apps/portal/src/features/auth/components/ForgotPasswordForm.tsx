"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input, Label } from "@timber/ui";
import { requestPasswordRecovery } from "../actions/passwordRecovery";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setIsPending(true); setError(null); setMessage(null);
    const result = await requestPasswordRecovery({ email });
    if (result.success) setMessage(result.data.message); else setError(result.error);
    setIsPending(false);
  }

  if (message) return <div className="space-y-4 text-center"><p role="status" className="text-sm text-muted-foreground">{message}</p><Button variant="outline" asChild><Link href="/login?reauth=1">Return to login</Link></Button></div>;
  return <form className="space-y-4" onSubmit={submit}>
    <div className="space-y-2"><Label htmlFor="recovery-email">Email</Label><Input id="recovery-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required disabled={isPending} />{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>
    <Button className="w-full" disabled={isPending} type="submit">{isPending ? "Sending..." : "Send recovery link"}</Button>
    <Button className="w-full" variant="ghost" asChild><Link href="/login?reauth=1">Back to login</Link></Button>
  </form>;
}
