"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Building2, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Button,
  Input,
} from "@timber/ui";
import { startViewAsOrg, startViewAsUser } from "../actions/viewAs";

interface Organization {
  id: string;
  code: string;
  name: string;
}

interface ViewAsUser {
  id: string;
  name: string;
  email: string;
}

interface ViewAsSelectorProps {
  organizations: Organization[];
  selectedOrgUsers?: ViewAsUser[];
  onOrgSelect?: (orgId: string) => void;
}

/**
 * Dialog for selecting an organization or user to view as
 */
export function ViewAsSelector({
  organizations,
  selectedOrgUsers,
  onOrgSelect,
}: ViewAsSelectorProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const filteredOrgs = organizations.filter(
    (org) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOrgSelect = async (org: Organization) => {
    if (onOrgSelect) {
      setSelectedOrg(org);
      onOrgSelect(org.id);
    } else {
      // Direct org view as
      setIsLoading(true);
      const result = await startViewAsOrg(org.id);
      setIsLoading(false);

      if (result.success) {
        setIsOpen(false);
        router.refresh();
      } else {
        alert(result.error || "Failed to start View As");
      }
    }
  };

  const handleUserSelect = async (user: ViewAsUser) => {
    setIsLoading(true);
    const result = await startViewAsUser(user.id);
    setIsLoading(false);

    if (result.success) {
      setIsOpen(false);
      router.refresh();
    } else {
      alert(result.error || "Failed to start View As");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="h-4 w-4 mr-2" />
          View As
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>View As Organization</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="Search organizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {selectedOrg && selectedOrgUsers ? (
            // Show users in selected org
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                {selectedOrg.code} - {selectedOrg.name}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedOrg(null)}
                  className="ml-auto"
                >
                  Back
                </Button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {selectedOrgUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    disabled={isLoading}
                    className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent text-left"
                  >
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {user.email}
                      </div>
                    </div>
                  </button>
                ))}
                {selectedOrgUsers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No users in this organization
                  </p>
                )}
              </div>
            </div>
          ) : (
            // Show organizations
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredOrgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleOrgSelect(org)}
                  disabled={isLoading}
                  className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent text-left"
                >
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{org.code}</div>
                    <div className="text-xs text-muted-foreground">
                      {org.name}
                    </div>
                  </div>
                </button>
              ))}
              {filteredOrgs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No organizations found
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
