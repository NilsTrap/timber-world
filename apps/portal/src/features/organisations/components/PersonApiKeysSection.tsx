"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@timber/ui";
import { KeyRound, Plus, Loader2, Copy, Ban } from "lucide-react";
import {
  issueMcpApiKey,
  listMcpApiKeys,
  revokeMcpApiKey,
  type McpApiKeyRow,
} from "../actions";

interface PersonApiKeysSectionProps {
  personId: string;
  /** Org pin options — the person's memberships. */
  orgOptions: { id: string; name: string }[];
}

const NO_PIN = "__none__";

function formatDateTime(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Epic T / T1 · super-admin surface to issue / list / revoke a person's MCP API
 * keys. The plaintext key is shown ONCE (issue dialog); only its hash is stored.
 */
export function PersonApiKeysSection({ personId, orgOptions }: PersonApiKeysSectionProps) {
  const [keys, setKeys] = useState<McpApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [orgPin, setOrgPin] = useState<string>(NO_PIN);
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<{ plaintext: string; label: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<McpApiKeyRow | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await listMcpApiKeys(personId);
    if (r.success) setKeys(r.data);
    else toast.error(r.error);
    setLoading(false);
  }, [personId]);

  useEffect(() => {
    load();
  }, [load]);

  const onIssue = async () => {
    setIssuing(true);
    const r = await issueMcpApiKey(personId, label.trim() || null, orgPin === NO_PIN ? null : orgPin);
    setIssuing(false);
    if (r.success) {
      setIssued({ plaintext: r.data.plaintext, label: r.data.label });
      setCopied(false);
      setLabel("");
      setOrgPin(NO_PIN);
      load();
    } else {
      toast.error(r.error);
    }
  };

  const onCopy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.plaintext);
      setCopied(true);
      toast.success("Key copied to clipboard");
    } catch {
      toast.error("Copy failed — select and copy the key manually");
    }
  };

  const onRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    const r = await revokeMcpApiKey(revokeTarget.id);
    setRevoking(false);
    if (r.success) {
      toast.success("Key revoked");
      setRevokeTarget(null);
      load();
    } else {
      toast.error(r.error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          MCP API keys
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Issue form */}
        <div className="rounded-lg border p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <Label htmlFor="mcp-key-label">Label</Label>
              <Input
                id="mcp-key-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Oscar workflow"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Default org pin (optional)</Label>
              <Select value={orgPin} onValueChange={setOrgPin}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="No pin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PIN}>No pin (use primary / per-call)</SelectItem>
                  {orgOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={onIssue} disabled={issuing}>
              {issuing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Issue key
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            A key grants MCP access scoped to this user&apos;s own portal permissions (row-level walls
            apply). The full key is shown once at creation and cannot be retrieved later.
          </p>
        </div>

        {/* Key list */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : keys.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No MCP keys issued.</p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => {
              const revoked = !!k.revokedAt;
              return (
                <div
                  key={k.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${revoked ? "opacity-60" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{k.label || "Unlabelled key"}</span>
                      {revoked ? (
                        <Badge variant="secondary">Revoked</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                      {k.organisationName && (
                        <Badge variant="outline" className="text-[10px]">
                          Pin: {k.organisationName}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Created {formatDateTime(k.createdAt)} · Last used {formatDateTime(k.lastUsedAt)}
                      {revoked ? ` · Revoked ${formatDateTime(k.revokedAt)}` : ""}
                    </div>
                  </div>
                  {!revoked && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRevokeTarget(k)}
                      title="Revoke this key"
                    >
                      <Ban className="h-4 w-4 mr-1" /> Revoke
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Show-once plaintext dialog */}
      <Dialog open={!!issued} onOpenChange={(o) => !o && setIssued(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy your MCP key now</DialogTitle>
            <DialogDescription>
              This is the only time the full key is shown. Store it somewhere safe — it cannot be
              retrieved again. If lost, revoke it and issue a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-muted px-3 py-2 font-mono text-xs">
              {issued?.plaintext}
            </code>
            <Button variant="outline" size="sm" onClick={onCopy}>
              <Copy className="h-4 w-4 mr-1" /> {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setIssued(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !revoking && !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke MCP key</AlertDialogTitle>
            <AlertDialogDescription>
              Revoke <strong>{revokeTarget?.label || "this key"}</strong>? Any integration using it
              will immediately lose access. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onRevoke} disabled={revoking}>
              {revoking ? "Revoking..." : "Revoke"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
