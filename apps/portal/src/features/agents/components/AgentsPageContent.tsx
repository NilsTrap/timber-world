"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { Button, Input } from "@timber/ui";
import { toast } from "sonner";
import { createAgent, updateAgent, deleteAgent, type Agent } from "../actions/agents";

interface Props {
  agents: Agent[];
}

export function AgentsPageContent({ agents: initialAgents }: Props) {
  const router = useRouter();
  const [agents, setAgents] = useState(initialAgents);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setEmail(""); setPassword(""); setFirstName(""); setLastName(""); setPhone(""); setRegion("");
    setShowForm(false); setEditing(null);
  };

  const startEdit = (a: Agent) => {
    setEditing(a);
    setFirstName(a.firstName); setLastName(a.lastName);
    setPhone(a.phone || ""); setRegion(a.region || "");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (editing) {
      setSaving(true);
      const result = await updateAgent({
        id: editing.id, firstName, lastName,
        phone: phone || null, region: region || null,
      });
      setSaving(false);
      if (result.success) {
        setAgents(agents.map((a) => a.id === editing.id ? result.data : a));
        toast.success("Agent updated");
        resetForm();
      } else {
        toast.error(result.error);
      }
    } else {
      if (!email.trim() || !password.trim() || !firstName.trim()) {
        toast.error("Email, password, and first name are required");
        return;
      }
      setSaving(true);
      const result = await createAgent({
        email: email.trim(), password, firstName: firstName.trim(),
        lastName: lastName.trim(), phone: phone || undefined, region: region || undefined,
      });
      setSaving(false);
      if (result.success) {
        setAgents([result.data, ...agents]);
        toast.success(`Agent "${result.data.email}" created`);
        resetForm();
      } else {
        toast.error(result.error);
      }
    }
  };

  const handleToggleActive = async (a: Agent) => {
    const result = await updateAgent({ id: a.id, isActive: !a.isActive });
    if (result.success) {
      setAgents(agents.map((x) => x.id === a.id ? result.data : x));
      toast.success(a.isActive ? "Agent deactivated" : "Agent activated");
    } else {
      toast.error(result.error);
    }
  };

  const handleDelete = async (a: Agent) => {
    if (!confirm(`Delete agent "${a.email}"? This removes their login and cannot be undone.`)) return;
    const result = await deleteAgent(a.id);
    if (result.success) {
      setAgents(agents.filter((x) => x.id !== a.id));
      toast.success("Agent deleted");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Agents</h1>
          <p className="text-muted-foreground">Manage agent accounts for the Timber Agents app</p>
        </div>
        {!showForm && (
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Agent
          </Button>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{editing ? "Edit Agent" : "New Agent"}</h3>
            <Button variant="ghost" size="icon" onClick={resetForm}><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">First Name</label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Last Name</label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          {!editing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="agent@example.com" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Password</label>
                <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Initial password" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Phone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 ..." />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Region</label>
              <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="South East" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Update Agent" : "Create Agent"}
            </Button>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium">Name</th>
              <th className="text-left px-4 py-2.5 font-medium">Email</th>
              <th className="text-left px-4 py-2.5 font-medium">Region</th>
              <th className="text-left px-4 py-2.5 font-medium">Tier</th>
              <th className="text-center px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium">{`${a.firstName} ${a.lastName}`.trim() || "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{a.email}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{a.region || "—"}</td>
                <td className="px-4 py-2.5 capitalize">{a.commissionTier}</td>
                <td className="px-4 py-2.5 text-center">
                  <button
                    onClick={() => handleToggleActive(a)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      a.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {a.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(a)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(a)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {agents.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No agents yet. Add your first agent to give them access to the catalog app.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
