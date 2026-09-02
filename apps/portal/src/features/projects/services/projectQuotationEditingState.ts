import type { ProjectRfqCandidate } from "../actions/projectRfqActions";
import type { ProjectQuotationPricingMode } from "./projectQuotationRows";

export type ProjectQuotationEditingState = {
  candidateId: string | null;
  activeCandidate: ProjectRfqCandidate | null;
  mode: ProjectQuotationPricingMode | null;
  prices: Record<string, string>;
  pending: boolean;
  canManage: boolean;
};

export function replaceProjectQuotationEditingState(_current: ProjectQuotationEditingState, next: ProjectQuotationEditingState): ProjectQuotationEditingState {
  return next;
}

export function setProjectQuotationEditingPrices(current: ProjectQuotationEditingState, prices: Record<string, string>): ProjectQuotationEditingState {
  return { ...current, prices };
}

export function setProjectQuotationEditingMode(current: ProjectQuotationEditingState, mode: ProjectQuotationPricingMode | null): ProjectQuotationEditingState {
  return { ...current, mode };
}

export function setProjectQuotationControlState(current: ProjectQuotationEditingState, next: Omit<ProjectQuotationEditingState, "mode" | "prices">): ProjectQuotationEditingState {
  return { ...next, mode: current.mode, prices: current.prices };
}
