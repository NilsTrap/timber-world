"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@timber/ui";
import { getOrganisations } from "../actions";
import type { Organisation } from "../types";
import { TradingPartnersTab } from "./TradingPartnersTab";

/**
 * Legacy Trading-Partners manager. Trading partners are an org-scoped relationship
 * (they used to be a tab inside the org detail); this page lets an admin pick an
 * org and manage its partners from under the Legacy nav group. Partner links are
 * now mostly maintained automatically by the CRM (a counterparty create links the
 * house trader), so this surface is retained for manual edits only.
 */
export function TradingPartnersLegacyManager() {
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    let alive = true;
    getOrganisations({ includeInactive: true }).then((res) => {
      if (alive && res.success) setOrgs(res.data);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger>
            <SelectValue placeholder="Select an organisation…" />
          </SelectTrigger>
          <SelectContent>
            {orgs.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
                {o.code ? ` (${o.code})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {selectedId ? (
        <TradingPartnersTab organisationId={selectedId} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Pick an organisation to manage its trading partners.
        </p>
      )}
    </div>
  );
}
