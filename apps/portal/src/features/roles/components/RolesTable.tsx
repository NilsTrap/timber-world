"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Badge,
} from "@timber/ui";
import { Pencil, Trash2, Shield } from "lucide-react";
import type { Role } from "../actions";
import { deleteRole } from "../actions";
import { RoleFormDialog } from "./RoleFormDialog";
import type { FeaturesByCategory } from "../actions";

interface RolesTableProps {
  roles: Role[];
  featuresByCategory: FeaturesByCategory;
}

export function RolesTable({ roles, featuresByCategory }: RolesTableProps) {
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingRole(null);
    setIsDialogOpen(true);
  };

  const handleDelete = async (role: Role) => {
    if (role.isSystem) {
      alert("System roles cannot be deleted");
      return;
    }

    const confirmed = window.confirm(
      `Delete role "${role.name}"? ${role.userCount ? `This will affect ${role.userCount} user(s).` : ""}`
    );

    if (!confirmed) return;

    setIsDeleting(role.id);
    const result = await deleteRole(role.id);
    setIsDeleting(null);

    if (!result.success) {
      alert(result.error || "Failed to delete role");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Roles</h2>
        <Button onClick={handleCreate}>
          <Shield className="h-4 w-4 mr-2" />
          Add Role
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-center">Permissions</TableHead>
            <TableHead className="text-center">Users</TableHead>
            <TableHead className="text-center">Type</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <TableRow key={role.id}>
              <TableCell className="font-medium">{role.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {role.description || "-"}
              </TableCell>
              <TableCell className="text-center">
                {role.permissions.includes("*")
                  ? "All"
                  : role.permissions.length}
              </TableCell>
              <TableCell className="text-center">{role.userCount || 0}</TableCell>
              <TableCell className="text-center">
                {role.isSystem ? (
                  <Badge variant="secondary">System</Badge>
                ) : (
                  <Badge variant="outline">Custom</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(role)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(role)}
                    disabled={role.isSystem || isDeleting === role.id}
                    className={role.isSystem ? "opacity-30 cursor-not-allowed" : ""}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <RoleFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        role={editingRole}
        featuresByCategory={featuresByCategory}
      />
    </div>
  );
}
