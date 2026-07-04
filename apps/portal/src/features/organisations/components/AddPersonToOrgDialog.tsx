"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, Search, Building2, Plus } from "lucide-react";
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
import {
  addExistingUserToOrganisation,
  getAddableOrganisationsForPerson,
  type AddableOrg,
} from "../actions";

interface AddPersonToOrgDialogProps {
  personId: string;
  personName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/**
 * K2 · Add a KNOWN person to an organisation (person-centric inverse of the
 * org-side AddUserDialog). Picks from the orgs the person is NOT already in, then
 * calls addExistingUserToOrganisation (which runs the Q2 scope wall server-side —
 * admins unrestricted). Access groups for the new membership are then managed via
 * the per-org "Groups" action.
 */
export function AddPersonToOrgDialog({
  personId,
  personName,
  open,
  onOpenChange,
  onSuccess,
}: AddPersonToOrgDialogProps) {
  const [orgs, setOrgs] = useState<AddableOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setQuery("");
    getAddableOrganisationsForPerson(personId).then((r) => {
      if (r.success) setOrgs(r.data);
      else toast.error(r.error);
      setLoading(false);
    });
  }, [open, personId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter((o) => o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q));
  }, [orgs, query]);

  const handleAdd = async (org: AddableOrg) => {
    setAddingId(org.id);
    const r = await addExistingUserToOrganisation(personId, org.id);
    setAddingId(null);
    if (r.success) {
      toast.success(`${personName} added to ${org.name}`);
      onOpenChange(false);
      onSuccess();
    } else if (r.code === "ALREADY_MEMBER") {
      toast.error("Already a member of that organisation");
    } else {
      toast.error(r.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Add to organisation
          </DialogTitle>
          <DialogDescription>Add {personName} to another organisation.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="org-search">Find an organisation</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="org-search"
              className="pl-9"
              placeholder="Search by name or code"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {orgs.length === 0 ? "Already a member of every active organisation." : "No matching organisations."}
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((org) => (
                <div key={org.id} className="flex items-center gap-2 rounded-md p-2 hover:bg-accent/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{org.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{org.code}</p>
                  </div>
                  <Button type="button" size="sm" onClick={() => handleAdd(org)} disabled={addingId !== null}>
                    {addingId === org.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1" /> Add
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={addingId !== null}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
