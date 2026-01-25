"use client";

/**
 * Accept Invite Form Component
 *
 * Handles Supabase invite tokens and allows users to set their password.
 * The email is pre-filled from the invite token and cannot be changed.
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { Button, Input, Label } from "@timber/ui";
import { createClient } from "@/lib/supabase/client";
import { completeInvite } from "../actions/completeInvite";

const setPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SetPasswordInput = z.infer<typeof setPasswordSchema>;

type InviteState =
  | { status: "loading" }
  | { status: "ready"; email: string; name: string | null }
  | { status: "error"; message: string }
  | { status: "no_token" };

export function AcceptInviteForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [inviteState, setInviteState] = useState<InviteState>({
    status: "loading",
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetPasswordInput>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  // Process the invite token on mount
  useEffect(() => {
    async function processInviteToken() {
      const supabase = createClient();

      // Check if we have hash params (Supabase adds tokens to the URL hash)
      const hashParams = new URLSearchParams(
        window.location.hash.substring(1) // Remove the # prefix
      );

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const type = hashParams.get("type");

      // If no tokens in hash, check if there's already a session (user refreshed the page)
      if (!accessToken) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          // Check if user needs to set password (invited but not yet active)
          const userMeta = session.user.user_metadata;
          setInviteState({
            status: "ready",
            email: session.user.email || "",
            name: (userMeta?.name as string) || null,
          });
          return;
        }

        setInviteState({ status: "no_token" });
        return;
      }

      // Verify this is an invite token
      if (type !== "invite" && type !== "recovery" && type !== "signup") {
        setInviteState({
          status: "error",
          message: "Invalid invitation link. Please contact your administrator.",
        });
        return;
      }

      // Set up the session using the tokens
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || "",
      });

      if (error || !data.user) {
        console.error("Failed to set session:", error);
        setInviteState({
          status: "error",
          message:
            "This invitation link has expired or is invalid. Please contact your administrator for a new invite.",
        });
        return;
      }

      // Clear the hash from the URL (for cleaner UX)
      window.history.replaceState(null, "", window.location.pathname);

      const userMeta = data.user.user_metadata;
      setInviteState({
        status: "ready",
        email: data.user.email || "",
        name: (userMeta?.name as string) || null,
      });
    }

    processInviteToken();
  }, []);

  const onSubmit = async (data: SetPasswordInput) => {
    if (inviteState.status !== "ready") return;

    setIsLoading(true);

    try {
      const result = await completeInvite(data.password);

      if (result.success) {
        toast.success("Account activated! Redirecting...");
        router.push(result.data.redirectTo);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("An unexpected error occurred. Please try again.");
      console.error("Accept invite error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (inviteState.status === "loading") {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Verifying invitation...</p>
      </div>
    );
  }

  // No token state
  if (inviteState.status === "no_token") {
    return (
      <div className="text-center py-8 space-y-4">
        <p className="text-muted-foreground">
          No invitation found. Please use the link from your invitation email.
        </p>
        <Button variant="outline" onClick={() => router.push("/login")}>
          Go to Login
        </Button>
      </div>
    );
  }

  // Error state
  if (inviteState.status === "error") {
    return (
      <div className="text-center py-8 space-y-4">
        <p className="text-destructive">{inviteState.message}</p>
        <Button variant="outline" onClick={() => router.push("/login")}>
          Go to Login
        </Button>
      </div>
    );
  }

  // Ready state - show the password form
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {inviteState.name && (
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={inviteState.name} disabled className="bg-muted" />
        </div>
      )}

      <div className="space-y-2">
        <Label>Email</Label>
        <Input value={inviteState.email} disabled className="bg-muted" />
        <p className="text-xs text-muted-foreground">
          This is the email address you were invited with
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="Enter your password (min 8 characters)"
          {...register("password")}
          aria-invalid={errors.password ? "true" : "false"}
          disabled={isLoading}
          autoComplete="new-password"
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Confirm your password"
          {...register("confirmPassword")}
          aria-invalid={errors.confirmPassword ? "true" : "false"}
          disabled={isLoading}
          autoComplete="new-password"
        />
        {errors.confirmPassword && (
          <p className="text-sm text-destructive">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Activating account..." : "Set Password & Continue"}
      </Button>
    </form>
  );
}
