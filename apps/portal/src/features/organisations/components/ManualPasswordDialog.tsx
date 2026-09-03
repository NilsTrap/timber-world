"use client";

import { useRef, useState } from "react";
import { Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label } from "@timber/ui";
import { generateTemporaryPassword } from "@/lib/utils/generatePassword";
import { resetUserPassword } from "../actions";

export interface ManualPasswordTarget { id: string; name: string }

interface Props {
  user: ManualPasswordTarget | null;
  organisationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void | Promise<void>;
}

export function ManualPasswordDialog({ user, organisationId, open, onOpenChange, onSuccess }: Props) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const clear = () => { setPassword(""); setConfirmation(""); setError(null); setRevealed(false); };
  const close = () => { clear(); onOpenChange(false); };

  const submit = async () => {
    if (!user || !organisationId || submittingRef.current) return;
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (password !== confirmation) return setError("Passwords do not match");
    submittingRef.current = true;
    setSubmitting(true);
    try {
      setError(null);
      const result = await resetUserPassword(user.id, organisationId, { password, confirmation });
      if (!result.success) { setError(result.error); return; }
      toast.success("Password updated");
      close();
    } catch {
      setError("Password could not be updated; try again");
      return;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
    try { await onSuccess(); } catch { toast.error("Password updated, but the page could not be refreshed"); }
  };

  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(password);
      toast.success("Password copied");
    } catch { toast.error("Password could not be copied"); }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !submitting) close(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Set password</DialogTitle><DialogDescription>Set a new password for {user?.name}. It will not be sent by email.</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <div className="space-y-2"><Label htmlFor="manual-password">New password</Label><div className="flex gap-2">
            <Input id="manual-password" type={revealed ? "text" : "password"} autoComplete="new-password" value={password} aria-describedby={error ? "manual-password-error" : undefined} aria-invalid={!!error} onChange={(event) => { setPassword(event.target.value); setError(null); }} disabled={submitting} />
            <Button type="button" variant="outline" size="icon" disabled={submitting} onClick={() => setRevealed((value) => !value)} aria-label={revealed ? "Hide password" : "Show password"}>{revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
            <Button type="button" variant="outline" size="icon" disabled={!password || submitting} aria-label="Copy password" onClick={() => void copy()}><Copy className="h-4 w-4" /></Button>
          </div></div>
          <div className="space-y-2"><Label htmlFor="manual-password-confirmation">Confirm password</Label><Input id="manual-password-confirmation" type={revealed ? "text" : "password"} autoComplete="new-password" value={confirmation} aria-describedby={error ? "manual-password-error" : undefined} aria-invalid={!!error} onChange={(event) => { setConfirmation(event.target.value); setError(null); }} disabled={submitting} /></div>
          {error && <p id="manual-password-error" role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="outline" onClick={() => { const generated = generateTemporaryPassword(12); setPassword(generated); setConfirmation(generated); setError(null); setRevealed(true); }} disabled={submitting}>Generate</Button>
            <div className="flex gap-2"><Button type="button" variant="outline" onClick={close} disabled={submitting}>Cancel</Button><Button type="submit" disabled={submitting || !user || !organisationId}>{submitting && <Loader2 className="h-4 w-4 animate-spin" />}Set password</Button></div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
