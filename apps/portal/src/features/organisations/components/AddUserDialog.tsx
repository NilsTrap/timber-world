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
  Checkbox,
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
 * One pass: (1) search existing platform users and add them, or (2) create a new
 * user — and in BOTH branches assign access groups inline. Admin vs book-scoped
 * (salesperson/purchasing) is decided by the server via getAddPersonContext:
 *  - admin  → full access-group picker.
 *  - scoped → the group is forced server-side (shown read-only, no picker).
 *  - forbidden → the caller may not add people here.
 * The client only reflects this; the create/add server actions re-enforce it.
 */
export function AddUserDialog({
  organisationId,
  open,
  onOpenChange,
  onSuccess,
}: AddUserDialogProps) {
  const [ctx, setCtx] = useState<AddPersonContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);

  // Inline group selection (admin only; scoped forces the group server-side).
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  // Existing-user typeahead
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<AddablePerson[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);

  // Create-new form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [sendInvite, setSendInvite] = useState(true);
  const [makePrimary, setMakePrimary] = useState(false);

  const groupIdsForSubmit = () =>
    ctx?.mode === "admin" ? Array.from(selectedGroups) : undefined;

  // Load context + reset on open.
  useEffect(() => {
    if (!open) return;
    setCtx(null);
    setCtxLoading(true);
    setSelectedGroups(new Set());
    setQuery("");
    setResults([]);
    setName("");
    setEmail("");
    setSendInvite(true);
    setMakePrimary(false);
    getAddPersonContext(organisationId).then((r) => {
      if (r.success) {
        setCtx(r.data);
        setSelectedGroups(new Set(
          r.data.groups.filter((group) => group.recommended && !group.disabled).map((group) => group.id),
        ));
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

  const toggleGroup = (id: string) =>
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleAddExisting = useCallback(
    async (person: AddablePerson) => {
      setAddingId(person.id);
      const r = await addExistingUserToOrganisation(person.id, organisationId, groupIdsForSubmit(), { makePrimary, sendInvite });
      setAddingId(null);
      if (r.success) {
        if (r.data.inviteError) toast.warning(r.data.inviteError);
        else toast.success(`${person.name} added to organisation${r.data.inviteSent ? " and invited" : ""}`);
        onOpenChange(false);
        onSuccess();
      } else if (r.code === "ALREADY_MEMBER") {
        toast.error("User is already a member of this organisation");
      } else {
        toast.error(r.error);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organisationId, selectedGroups, ctx, makePrimary, sendInvite],
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
      groupIdsForSubmit(),
      { sendInvite },
    );
    setIsCreating(false);
    if (r.success) {
      if (r.data.inviteError) toast.warning(r.data.inviteError);
      else toast.success(r.data.inviteSent ? "User created and invited" : "User created");
      onOpenChange(false);
      onSuccess();
    } else if (r.code === "DUPLICATE_EMAIL") {
      toast.error("Email already registered");
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
          <DialogDescription>Add an existing person {orgLabel}, or create a new user.</DialogDescription>
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
            {/* Inline access-group step */}
            {ctx?.mode === "admin" ? (
              <div className="space-y-2">
                <Label>Access groups</Label>
                {ctx.groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No access groups available.</p>
                ) : (
                  <div className="space-y-1 rounded-lg border p-2">
                    {ctx.groups.map((g) => (
                      <div key={g.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`grp-${g.id}`}
                          checked={selectedGroups.has(g.id)}
                          onCheckedChange={() => toggleGroup(g.id)}
                          disabled={busy || g.disabled}
                        />
                        <label htmlFor={`grp-${g.id}`} className="flex-1 text-sm cursor-pointer">
                          {g.name}
                          <span className="ml-2 font-mono text-xs text-muted-foreground">{g.key}</span>
                          <span className="block text-[11px] font-normal text-muted-foreground">
                            {g.disabled
                              ? "Unavailable under this organisation's module ceiling"
                              : `${g.effectiveModules.length} effective module${g.effectiveModules.length === 1 ? "" : "s"}${g.unavailableModules.length ? ` · ${g.unavailableModules.length} capped` : ""}`}
                          </span>
                        </label>
                        {g.isSystem && (
                          <Badge variant="secondary" className="text-[10px]">System</Badge>
                        )}
                        {g.recommended && (
                          <Badge className="text-[10px]">Recommended</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Applied to whichever person you add or create below.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                New members are added to the{" "}
                <Badge variant="secondary">{ctx?.forcedGroupName}</Badge> group.
              </div>
            )}

            {/* Find existing person */}
            <div className="space-y-2">
              <Label htmlFor="person-search">Find an existing person</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="person-search"
                  className="pl-9"
                  placeholder="Search by name or email"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={busy}
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {query.trim().length >= 2 && !isSearching && results.length === 0 && (
                <p className="text-sm text-muted-foreground">No matching people. Create a new user below.</p>
              )}
              {results.length > 0 && (
                <div className="space-y-1 rounded-lg border p-1">
                  {results.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 rounded-md p-2 hover:bg-accent/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                      </div>
                      {p.alreadyMember ? (
                        <span className="text-xs text-amber-600 font-medium">Already a member</span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleAddExisting(p)}
                          disabled={busy}
                        >
                          {addingId === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <UserPlus className="h-4 w-4 mr-1" /> Add
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Checkbox id="send-passwordless-invite" checked={sendInvite} onCheckedChange={(v) => setSendInvite(v === true)} disabled={busy} />
                <label htmlFor="send-passwordless-invite" className="text-sm cursor-pointer">Send passwordless invite now</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="make-primary-membership" checked={makePrimary} onCheckedChange={(v) => setMakePrimary(v === true)} disabled={busy} />
                <label htmlFor="make-primary-membership" className="text-sm cursor-pointer">Make primary when attaching an existing person</label>
              </div>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-2 text-xs uppercase text-muted-foreground">or create a new user</span>
              </div>
            </div>

            {/* Create new user */}
            <div className="space-y-3">
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
              <div className="space-y-2">
                <Label htmlFor="new-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new-name"
                  placeholder="Enter user's full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The membership is active immediately. The optional invite contains no password.
              </p>
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
                  "Create user"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
