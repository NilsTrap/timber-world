import assert from "node:assert/strict";
import {
  calculateComponentTotalCents,
  calculateLineTotalCents,
  canEditProjectSpecification,
  moneyToCents,
  projectSpecificationEditDenialCode,
} from "../projectSpecification";

assert.equal(moneyToCents(12.345), 1235, "money rounds once at the cent boundary");
assert.equal(calculateLineTotalCents(2.5, 40.2), 10050, "line total is quantity times sell price");
assert.equal(calculateComponentTotalCents(3.25, 12.4), 4030, "cost total is quantity times unit cost");

const draftRoot = {
  lifecycleStage: "draft",
  dealKind: "buy_sell",
  sellerOrganisationId: "seller",
};

assert.equal(canEditProjectSpecification({ ...draftRoot, isPlatformAdmin: true, actorOrganisationId: null, sellerIsActiveTrader: false }), true, "platform admins may edit a draft buy/sell root");
assert.equal(canEditProjectSpecification({ ...draftRoot, lifecycleStage: "specification", isPlatformAdmin: true, actorOrganisationId: null, sellerIsActiveTrader: false }), true, "platform admins may edit a root in the specification stage");
assert.equal(canEditProjectSpecification({ ...draftRoot, dealKind: "sale_only", isPlatformAdmin: true, actorOrganisationId: null, sellerIsActiveTrader: false }), true, "legacy sale-only roots remain editable");
assert.equal(canEditProjectSpecification({ ...draftRoot, isPlatformAdmin: false, actorOrganisationId: "seller", sellerIsActiveTrader: true }), true, "an active trader seller may edit without an unrelated commercial permission");
assert.equal(canEditProjectSpecification({ ...draftRoot, lifecycleStage: "specification", isPlatformAdmin: false, actorOrganisationId: "seller", sellerIsActiveTrader: true }), true, "the root trader may edit in the specification stage");
assert.equal(canEditProjectSpecification({ ...draftRoot, isPlatformAdmin: false, actorOrganisationId: "seller", sellerIsActiveTrader: false }), false, "a seller organisation without the trader persona cannot edit");
assert.equal(canEditProjectSpecification({ ...draftRoot, isPlatformAdmin: false, actorOrganisationId: "buyer", sellerIsActiveTrader: true }), false, "the root buyer cannot edit");
assert.equal(canEditProjectSpecification({ ...draftRoot, lifecycleStage: "confirmed", isPlatformAdmin: true, actorOrganisationId: null, sellerIsActiveTrader: true }), false, "a non-draft root is read-only");
assert.equal(canEditProjectSpecification({ ...draftRoot, dealKind: "purchase_only", isPlatformAdmin: true, actorOrganisationId: null, sellerIsActiveTrader: true }), false, "purchase-only downstream legs are read-only even for admins");
assert.equal(canEditProjectSpecification({ ...draftRoot, dealKind: "future_kind", isPlatformAdmin: true, actorOrganisationId: null, sellerIsActiveTrader: true }), false, "unknown deal kinds fail closed");
assert.equal(projectSpecificationEditDenialCode({ ...draftRoot, lifecycleStage: "confirmed", isPlatformAdmin: true, actorOrganisationId: null, sellerIsActiveTrader: true }), "NOT_DRAFT", "valid non-draft roots preserve NOT_DRAFT");
assert.equal(projectSpecificationEditDenialCode({ ...draftRoot, dealKind: "purchase_only", lifecycleStage: "confirmed", isPlatformAdmin: true, actorOrganisationId: null, sellerIsActiveTrader: true }), "FORBIDDEN", "downstream legs remain FORBIDDEN regardless of lifecycle");
assert.equal(projectSpecificationEditDenialCode({ ...draftRoot, dealKind: "unknown", lifecycleStage: "confirmed", isPlatformAdmin: true, actorOrganisationId: null, sellerIsActiveTrader: true }), "FORBIDDEN", "unknown kinds remain FORBIDDEN regardless of lifecycle");

console.log("project specification tests passed");
