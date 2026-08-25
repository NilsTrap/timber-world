"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, UserPlus, Search, ShieldAlert } from "lucide-react";
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
  Badge,
} from "@timber/ui";
import {
  createOrganisationUser,
  addExistingUserToOrganisation,
  getAddPersonContext,
  searchAddablePeople,
} from "../actions";
import type { AddPersonContext, AddablePerson } from "../addPersonTypes";

interface AddUserDialogProps {
  organisationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const emailSchema = z.string().email().max(255);

/**
 * Add Person Dialog (K3 · one obvious flow)
 *
 * Creates a new person or re-invites a same-company person. The target company
 * determines the inherited Buyer, Trader or Manufacturer access preset.
 */
export function AddUserDialog({
  organisationId,
  open,
  onOpenChange,
  onSuccess,
}: AddUserDialogProps) {
  const [ctx, setCtx] = useState<AddPersonContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);

  // Existing-user typeahead
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<AddablePerson[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);

  // Create-new form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  // Load context + reset on open.
  useEffect(() => {
    if (!open) return;
    setCtx(null);
    setCtxLoading(true);
    setQuery("");
    setResults([]);
    setName("");
    setEmail("");
    getAddPersonContext(organisationId).then((r) => {
      if (r.success) {
        setCtx(r.data);
      }
      else toast.error(r.error);
      setCtxLoading(false);
    });
  }, [open, organisationId]);

  // Debounced typeahead search.
  useEffect(() => {
    if (!open || !ctx || ctx.mode === "forbidden") return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setIsSearching(true);
      const r = await searchAddablePeople(organisationId, q);
      if (r.success) setResults(r.data);
      else setResults([]);
      setIsSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [query, open, ctx, organisationId]);

  const handleAddExisting = useCallback(
    async (person: AddablePerson) => {
      setAddingId(person.id);
      const r = await addExistingUserToOrganisation(person.id, organisationId);
      setAddingId(null);
      if (r.success) {
        if (r.data.inviteError) toast.warning(r.data.inviteError);
        else toast.success(r.data.inviteSent ? `Invitation sent to ${person.email}` : `${person.name} restored`);
        onOpenChange(false);
        onSuccess();
      } else if (r.code === "ALREADY_MEMBER") {
        toast.error("User is already a member of this organisation");
      } else {
        toast.error(r.error);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organisationId, onOpenChange, onSuccess],
  );

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Name is required");
      return;
    }
    if (!emailSchema.safeParse(email.trim()).success) {
      toast.error("Enter a valid email address");
      return;
    }
    setIsCreating(true);
    const r = await createOrganisationUser(
      organisationId,
      { name: trimmedName, email: email.trim().toLowerCase() },
    );
    setIsCreating(false);
    if (r.success) {
      if (r.data.inviteError) toast.warning(r.data.inviteError);
      else toast.success(r.data.inviteSent ? "Person created and invited" : "Person created");
      onOpenChange(false);
      onSuccess();
    } else if (r.code === "EMAIL_UNAVAILABLE") {
      toast.error("This email cannot be added to this company");
    } else {
      toast.error(r.error);
    }
  };

  const orgLabel = ctx?.orgName ? `to ${ctx.orgName}` : "to this organisation";
  const busy = addingId !== null || isCreating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add person
          </DialogTitle>
          <DialogDescription>Create and invite a person {orgLabel}, or find an existing same-company person.</DialogDescription>
        </DialogHeader>

        {ctxLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : ctx?.mode === "forbidden" ? (
          <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-4 text-sm">
            <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
            <span>You don&apos;t have permission to add people to this organisation.</span>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-lg border bg-muted/50 p-3 text-sm">
              Portal access is inherited automatically from this company: {" "}
              <Badge variant="secondary">{ctx?.forcedGroupName}</Badge>
            </div>

            {/* Create new user */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="new-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new-name"
                  placeholder="Enter person's full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                An email invitation will be sent immediately. No password is included.
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center">
                <span className="bg-background px-2 text-xs uppercase text-muted-foreground">or find an existing person</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="person-search">Find an existing person</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="person-search" className="pl-9" placeholder="Search by name or email" value={query} onChange={(e) => setQuery(e.target.value)} disabled={busy} />
                {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {query.trim().length >= 2 && !isSearching && results.length === 0 && (
                <p className="text-sm text-muted-foreground">No matching person in this company.</p>
              )}
              {results.length > 0 && (
                <div className="space-y-1 rounded-lg border p-1">
                  {results.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 rounded-md p-2 hover:bg-accent/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                      </div>
                      {p.status === "active" && p.alreadyMember ? (
                        <span className="text-xs text-muted-foreground font-medium">Already active</span>
                      ) : (
                        <Button type="button" size="sm" onClick={() => handleAddExisting(p)} disabled={busy}>
                          {addingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                            <><UserPlus className="h-4 w-4 mr-1" />{p.membershipActive && p.isActive ? "Re-send invite" : "Restore & invite"}</>
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" onClick={handleCreate} disabled={busy}>
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...
                  </>
                ) : (
                  "Create & invite"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
