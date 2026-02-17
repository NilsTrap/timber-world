"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Checkbox,
} from "@timber/ui";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Check } from "lucide-react";
import {
  getTradingPartners,
  addTradingPartner,
  removeTradingPartner,
  getAvailablePartners,
} from "../actions";
import type { TradingPartner } from "../types";

interface AvailablePartner {
  id: string;
  code: string;
  name: string;
}

interface TradingPartnersTabProps {
  organisationId: string;
}

export function TradingPartnersTab({ organisationId }: TradingPartnersTabProps) {
  const [partners, setPartners] = useState<TradingPartner[]>([]);
  const [availablePartners, setAvailablePartners] = useState<AvailablePartner[]>([]);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [partnersResult, availableResult] = await Promise.all([
        getTradingPartners(organisationId),
        getAvailablePartners(organisationId),
      ]);

      if (partnersResult.success) {
        setPartners(partnersResult.data);
      } else {
        toast.error(partnersResult.error);
      }

      if (availableResult.success) {
        setAvailablePartners(availableResult.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [organisationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddPartners = async () => {
    if (selectedPartnerIds.size === 0) return;

    setIsAdding(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const partnerId of selectedPartnerIds) {
        const result = await addTradingPartner(organisationId, partnerId);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      if (errorCount === 0) {
        toast.success(`Added ${successCount} trading partner${successCount !== 1 ? "s" : ""}`);
      } else if (successCount > 0) {
        toast.warning(`Added ${successCount}, failed ${errorCount}`);
      } else {
        toast.error("Failed to add trading partners");
      }

      setSelectedPartnerIds(new Set());
      loadData();
    } finally {
      setIsAdding(false);
    }
  };

  const togglePartnerSelection = (partnerId: string) => {
    setSelectedPartnerIds((prev) => {
      const next = new Set(prev);
      if (next.has(partnerId)) {
        next.delete(partnerId);
      } else {
        next.add(partnerId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPartnerIds.size === availablePartners.length) {
      setSelectedPartnerIds(new Set());
    } else {
      setSelectedPartnerIds(new Set(availablePartners.map((p) => p.id)));
    }
  };

  const isAllSelected = availablePartners.length > 0 && selectedPartnerIds.size === availablePartners.length;

  const handleRemovePartner = async (partnerId: string) => {
    setRemovingId(partnerId);
    try {
      const result = await removeTradingPartner(organisationId, partnerId);
      if (result.success) {
        toast.success("Trading partner removed");
        loadData();
      } else {
        toast.error(result.error);
      }
    } finally {
      setRemovingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Trading partners are organisations that can appear in shipment dropdowns.
        When you add a partner, both organisations will be able to see each other.
      </p>

      {/* Add partner form */}
      {availablePartners.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Select organisations to add:</label>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSelectAll}
              className="text-xs"
            >
              {isAllSelected ? "Deselect All" : "Select All"}
            </Button>
          </div>
          <div className="rounded-md border max-h-48 overflow-y-auto">
            {availablePartners.map((org) => (
              <label
                key={org.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-accent cursor-pointer border-b last:border-b-0"
              >
                <Checkbox
                  checked={selectedPartnerIds.has(org.id)}
                  onCheckedChange={() => togglePartnerSelection(org.id)}
                />
                <span className="font-mono text-sm">{org.code}</span>
                <span className="text-sm text-muted-foreground">{org.name}</span>
              </label>
            ))}
          </div>
          <Button
            onClick={handleAddPartners}
            disabled={selectedPartnerIds.size === 0 || isAdding}
          >
            {isAdding ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Add {selectedPartnerIds.size > 0 ? `${selectedPartnerIds.size} ` : ""}Partner{selectedPartnerIds.size !== 1 ? "s" : ""}
          </Button>
        </div>
      ) : partners.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          All organisations are already trading partners.
        </p>
      ) : null}

      {/* Partners table */}
      {partners.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            No trading partners configured. This organisation cannot create shipments until partners are added.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {partners.map((partner) => (
              <TableRow key={partner.id}>
                <TableCell className="font-mono font-medium">
                  {partner.partnerCode}
                </TableCell>
                <TableCell>{partner.partnerName}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemovePartner(partner.partnerId)}
                    disabled={removingId === partner.partnerId}
                  >
                    {removingId === partner.partnerId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
