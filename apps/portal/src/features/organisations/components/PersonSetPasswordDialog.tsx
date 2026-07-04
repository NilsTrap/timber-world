"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@timber/ui";
import { setUserPasswordAdmin } from "../actions";

interface PersonSetPasswordDialogProps {
  personId: string;
  personName: string;
  /** Whether the user has a login yet (auth_user_id). If not, we tell them to send credentials first. */
  hasAuthUser: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Q4 · Admin manual set-password.
 *
 * Sets a login password directly (no email round-trip). Admin-only server-side
 * (setUserPasswordAdmin guards isAdmin/isSuperAdmin). The password value stays in
 * component state and is sent once to the action — it is never logged anywhere.
 */
export function PersonSetPasswordDialog({
  personId,
  personName,
  hasAuthUser,
  open,
  onOpenChange,
}: PersonSetPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword("");
      setConfirm("");
    }
  }, [open]);

  const handleSave = async () => {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setIsSaving(true);
    const result = await setUserPasswordAdmin(personId, password);
    setIsSaving(false);
    if (result.success) {
      toast.success(`Password set for ${personName}`);
      setPassword("");
      setConfirm("");
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Set password
          </DialogTitle>
          <DialogDescription>
            Set a login password directly for <strong>{personName}</strong>. They can sign in with it
            immediately — no email is sent.
          </DialogDescription>
        </DialogHeader>

        {!hasAuthUser ? (
          <div className="rounded-lg border bg-muted/50 p-4 text-sm">
            This person has no login yet. Use <strong>Send credentials</strong> first, then you can set
            a password.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSaving}
              />
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          {hasAuthUser && (
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Setting...
                </>
              ) : (
                "Set password"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
