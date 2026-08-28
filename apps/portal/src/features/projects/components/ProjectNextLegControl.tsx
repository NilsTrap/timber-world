"use client";

import { ProjectCreateLegDialog } from "./ProjectCreateLegDialog";
import type { ProjectPartyWorkspace } from "../types";

export function ProjectNextLegControl({ projectId, workspace, initialOpen = false }: { projectId: string; workspace: ProjectPartyWorkspace; initialOpen?: boolean }) {
  if (!workspace.canCreateSpineLeg) return null;
  return <div className="[&_button]:border-primary [&_button]:bg-primary [&_button]:text-primary-foreground [&_button:hover]:bg-primary/90"><ProjectCreateLegDialog sourceProjectId={projectId} defaultBuyerId={workspace.seller?.id ?? null} buyerOptions={workspace.createBuyerOptions ?? []} sellerOptions={workspace.createSellerOptions ?? []} allocation={workspace.originAllocation ?? []} initialOpen={initialOpen} /></div>;
}
