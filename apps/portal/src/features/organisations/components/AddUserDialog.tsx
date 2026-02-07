"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, UserPlus, UserCheck } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Badge,
} from "@timber/ui";
import {
  createOrganisationUser,
  searchUserByEmail,
  addExistingUserToOrganisation,
} from "../actions";
import type { ExistingUserInfo } from "../actions";

interface AddUserDialogProps {
  organisationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// Form schema for adding a user
const addUserSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .trim(),
  email: z
    .string()
    .email("Invalid email address")
    .max(255, "Email must be 255 characters or less")
    .trim()
    .toLowerCase(),
});

type AddUserInput = z.infer<typeof addUserSchema>;

/**
 * Add User Dialog
 *
 * Modal form for adding a user to an organisation.
 * - If email matches an existing user, offers to add them to this org
 * - Otherwise creates a new user with status='created'
 */
export function AddUserDialog({
  organisationId,
  open,
  onOpenChange,
  onSuccess,
}: AddUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [existingUser, setExistingUser] = useState<ExistingUserInfo | null>(null);
  const [searchedEmail, setSearchedEmail] = useState<string>("");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AddUserInput>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      name: "",
      email: "",
    },
  });

  const emailValue = watch("email");

  // Reset form and state when dialog opens/closes
  useEffect(() => {
    if (open) {
      reset({ name: "", email: "" });
      setExistingUser(null);
      setSearchedEmail("");
    }
  }, [open, reset]);

  // Debounced email search
  useEffect(() => {
    const normalizedEmail = emailValue?.trim().toLowerCase() || "";

    // Don't search if email hasn't changed or is invalid
    if (normalizedEmail === searchedEmail) return;
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setExistingUser(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      const result = await searchUserByEmail(normalizedEmail);
      setSearchedEmail(normalizedEmail);

      if (result.success && result.data) {
        setExistingUser(result.data);
        // Pre-fill name if found
        setValue("name", result.data.name);
      } else {
        setExistingUser(null);
      }
      setIsSearching(false);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [emailValue, searchedEmail, setValue]);

  // Check if existing user is already in this organisation
  const isAlreadyMember = existingUser?.currentOrganisations.some(
    (org) => org.id === organisationId
  );

  const onSubmit = async (data: AddUserInput) => {
    setIsSubmitting(true);

    try {
      if (existingUser && !isAlreadyMember) {
        // Add existing user to organisation
        const result = await addExistingUserToOrganisation(
          existingUser.id,
          organisationId
        );

        if (result.success) {
          toast.success(`${existingUser.name} added to organisation`);
          reset();
          onOpenChange(false);
          onSuccess();
        } else {
          if (result.code === "ALREADY_MEMBER") {
            toast.error("User is already a member of this organisation");
          } else {
            toast.error(result.error);
          }
        }
      } else {
        // Create new user
        const result = await createOrganisationUser(organisationId, data);

        if (result.success) {
          toast.success("User created");
          reset();
          onOpenChange(false);
          onSuccess();
        } else {
          if (result.code === "DUPLICATE_EMAIL") {
            toast.error("Email already registered");
          } else {
            toast.error(result.error);
          }
        }
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddExistingUser = async () => {
    if (!existingUser || isAlreadyMember) return;

    setIsSubmitting(true);
    try {
      const result = await addExistingUserToOrganisation(
        existingUser.id,
        organisationId
      );

      if (result.success) {
        toast.success(`${existingUser.name} added to organisation`);
        reset();
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      reset();
      setExistingUser(null);
      setSearchedEmail("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                placeholder="Enter email address"
                {...register("email")}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            {errors.email && (
              <p id="email-error" className="text-sm text-destructive" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Existing User Found */}
          {existingUser && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                <span className="font-medium">Existing user found</span>
              </div>
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Name:</span>{" "}
                  <span className="font-medium">{existingUser.name}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Email:</span>{" "}
                  <span className="font-medium">{existingUser.email}</span>
                </p>
                {existingUser.currentOrganisations.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Current organisations:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {existingUser.currentOrganisations.map((org) => (
                        <Badge
                          key={org.id}
                          variant={org.id === organisationId ? "default" : "secondary"}
                        >
                          {org.code}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {isAlreadyMember ? (
                <p className="text-sm text-amber-600 font-medium">
                  This user is already a member of this organisation.
                </p>
              ) : (
                <Button
                  type="button"
                  onClick={handleAddExistingUser}
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add to This Organisation
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* New User Form (only show if no existing user found) */}
          {!existingUser && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Enter user's full name"
                  {...register("name")}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "name-error" : undefined}
                />
                {errors.name && (
                  <p id="name-error" className="text-sm text-destructive" role="alert">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                The user will be created with &quot;Created&quot; status. Login credentials can be generated separately.
              </p>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || isSearching}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create User"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Cancel button when existing user is shown */}
          {existingUser && (
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
