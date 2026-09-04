"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ProjectRfqCandidate } from "../actions/projectRfqActions";
import { setProjectQuotationControlState, setProjectQuotationEditingMode, setProjectQuotationEditingPrices, type ProjectQuotationEditingState } from "../services/projectQuotationEditingState";
import type { ProjectQuotationPricingMode } from "../services/projectQuotationRows";

type ProjectQuotationEditingContextValue = ProjectQuotationEditingState & {
  projectId: string;
  setControlState: (state: Omit<ProjectQuotationEditingState, "mode" | "prices">) => void;
  setMode: (mode: ProjectQuotationPricingMode | null) => void;
  setPrices: (prices: Record<string, string>) => void;
  setActiveCandidate: (candidate: ProjectRfqCandidate) => void;
  projectTotal: string;
  setProjectTotal: (value: string) => void;
  inlinePending: boolean;
  inlineStatus: "idle" | "saved" | "error";
  setInlineState: (pending: boolean, status: "idle" | "saved" | "error") => void;
};

const ProjectQuotationEditingContext = createContext<ProjectQuotationEditingContextValue | null>(null);

export function ProjectQuotationEditingProvider({ projectId, children }: { projectId: string; children: ReactNode }) {
  const [state, setState] = useState<ProjectQuotationEditingState>({ candidateId: null, activeCandidate: null, mode: null, prices: {}, pending: false, canManage: false });
  const [inlineState, setInlineStateValue] = useState<{ pending: boolean; status: "idle" | "saved" | "error" }>({ pending: false, status: "idle" });
  const [projectTotal, setProjectTotal] = useState("");
  const setControlState = useCallback((next: Omit<ProjectQuotationEditingState, "mode" | "prices">) => setState((current) => setProjectQuotationControlState(current, next)), []);
  const setMode = useCallback((mode: ProjectQuotationPricingMode | null) => setState((current) => setProjectQuotationEditingMode(current, mode)), []);
  const setPrices = useCallback((prices: Record<string, string>) => setState((current) => setProjectQuotationEditingPrices(current, prices)), []);
  const setActiveCandidate = useCallback((activeCandidate: ProjectRfqCandidate) => setState((current) => ({ ...current, activeCandidate })), []);
  const setInlineState = useCallback((pending: boolean, status: "idle" | "saved" | "error") => setInlineStateValue({ pending, status }), []);
  const value = useMemo<ProjectQuotationEditingContextValue>(() => ({
    projectId,
    ...state,
    setControlState,
    setMode,
    setPrices,
    setActiveCandidate,
    projectTotal,
    setProjectTotal,
    inlinePending: inlineState.pending,
    inlineStatus: inlineState.status,
    setInlineState,
  }), [inlineState, projectId, projectTotal, setActiveCandidate, setControlState, setInlineState, setMode, setPrices, state]);
  return <ProjectQuotationEditingContext.Provider value={value}>{children}</ProjectQuotationEditingContext.Provider>;
}

export function useProjectQuotationEditing() {
  const value = useContext(ProjectQuotationEditingContext);
  if (!value) throw new Error("Project quotation editing must be used inside its provider");
  return value;
}
