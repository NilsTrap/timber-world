import assert from "node:assert/strict";
import {
  calculateComponentTotalCents,
  calculateLineTotalCents,
  canEditProjectSpecification,
  moneyToCents,
} from "../projectSpecification";

assert.equal(moneyToCents(12.345), 1235, "money rounds once at the cent boundary");
assert.equal(calculateLineTotalCents(2.5, 40.2), 10050, "line total is quantity times sell price");
assert.equal(calculateComponentTotalCents(3.25, 12.4), 4030, "cost total is quantity times unit cost");

assert.equal(canEditProjectSpecification({ isPlatformAdmin: true, actorOrganisationId: null, sellerOrganisationId: "seller", dealTermsEditable: false, lifecycleStage: "draft" }), true);
assert.equal(canEditProjectSpecification({ isPlatformAdmin: false, actorOrganisationId: "seller", sellerOrganisationId: "seller", dealTermsEditable: true, lifecycleStage: "draft" }), true);
assert.equal(canEditProjectSpecification({ isPlatformAdmin: false, actorOrganisationId: "buyer", sellerOrganisationId: "seller", dealTermsEditable: true, lifecycleStage: "draft" }), false);
assert.equal(canEditProjectSpecification({ isPlatformAdmin: true, actorOrganisationId: null, sellerOrganisationId: "seller", dealTermsEditable: true, lifecycleStage: "confirmed" }), false);

console.log("project specification tests passed");
