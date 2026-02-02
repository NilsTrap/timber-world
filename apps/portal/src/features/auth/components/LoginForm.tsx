"use client";

/**
 * Login Form Component
 *
 * TODO [i18n]: Replace all hardcoded strings with useTranslations() from next-intl
 * when i18n is set up for the portal app.
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Input, Label } from "@timber/ui";
import { loginSchema, type LoginInput } from "../schemas/login";
import { loginUser } from "../actions/login";
import { markSessionVerified } from "@/components/SessionVerificationGuard";

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);

  // Get the return URL from query params on client side (avoids Suspense requirement)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReturnUrl(params.get("returnUrl"));
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
    resetField,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);

    try {
      const result = await loginUser(data);

      if (result.success) {
        // Mark session as verified in this browser window/tab
        markSessionVerified();
        toast.success("Welcome back!");
        // Redirect to return URL if provided, otherwise use the default redirect
        const redirectTo = returnUrl ? decodeURIComponent(returnUrl) : result.data.redirectTo;
        router.push(redirectTo);
        router.refresh(); // Refresh to update session state
      } else {
        toast.error(result.error);
        resetField("password"); // Clear password on error (AC2)
      }
    } catch (error) {
      toast.error("An unexpected error occurred. Please try again.");
      console.error("Login error:", error);
      resetField("password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      name="login"
      autoComplete="on"
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          {...register("email")}
          id="email"
          type="email"
          name="email"
          placeholder="Enter your email"
          aria-label="Email address"
          aria-invalid={errors.email ? "true" : "false"}
          disabled={isLoading}
          autoComplete="username email"
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          {...register("password")}
          id="password"
          type="password"
          name="password"
          placeholder="Enter your password"
          aria-label="Password"
          aria-invalid={errors.password ? "true" : "false"}
          disabled={isLoading}
          autoComplete="current-password"
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Signing in..." : "Sign In"}
      </Button>
    </form>
  );
}
