import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";
export const metadata: Metadata = { title: "Forgot password" };
export default function ForgotPasswordPage() { return <div className="space-y-6"><div className="space-y-2 text-center"><h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1><p className="text-sm text-muted-foreground">We will email you a secure recovery link.</p></div><div className="rounded-lg border bg-card p-6 shadow-sm"><ForgotPasswordForm /></div></div>; }
