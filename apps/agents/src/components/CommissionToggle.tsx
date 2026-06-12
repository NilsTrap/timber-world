"use client";

import { useState } from "react";
import { setShowCommissions } from "@/app/(app)/profile/actions";

export function CommissionToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    const next = !on;
    setOn(next);
    setSaving(true);
    const result = await setShowCommissions(next);
    setSaving(false);
    if (!result.success) setOn(!next); // revert on failure
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium">Show prices &amp; commissions</div>
        <div className="text-xs text-[var(--charcoal-light)]">When on, the catalog shows your commission on each product.</div>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        aria-pressed={on}
        className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${on ? "" : "bg-gray-300"}`}
        style={on ? { background: "var(--forest-green)" } : undefined}
      >
        <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}
