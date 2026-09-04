import type { Metadata } from "next";
import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";
export const metadata: Metadata = { title: "Reset password" };
export default function ResetPasswordPage() { return <div className="space-y-6"><div className="space-y-2 text-center"><h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1><p className="text-sm text-muted-foreground">Enter and confirm your new password.</p></div><div className="rounded-lg border bg-card p-6 shadow-sm"><ResetPasswordForm /></div></div>; }
