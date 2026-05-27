"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="w-full py-3 rounded-xl text-sm font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 transition-colors"
    >
      Sign Out
    </button>
  );
}
