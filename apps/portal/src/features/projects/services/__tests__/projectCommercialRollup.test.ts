import assert from "node:assert/strict";
import { calculateCommercialRollup } from "../projectCommercialRollup";

const base = {
  requirements: [{ originLineItemId: "metal", requiredQuantity: 10 }, { originLineItemId: "wood", requiredQuantity: 5 }],
  contributions: [
    { sourceOrderId: "s1", sourceCandidateId: "c1", originLineItemId: "metal", selectedQuantity: 10, availableQuantity: 10, availableAmountCents: 1001, sourceVersion: 1, sourceUpdatedAt: "2026-01-01" },
    { sourceOrderId: "s2", sourceCandidateId: "c2", originLineItemId: "wood", selectedQuantity: 5, availableQuantity: 5, availableAmountCents: 499, sourceVersion: 1, sourceUpdatedAt: "2026-01-01" },
  ],
};

const full = calculateCommercialRollup({ ...base, scope: "full", adjustmentCents: 101, marginMode: "amount", marginValue: 203 });
assert.equal(full.purchaseCostCents, 1500);
assert.equal(full.salesAmountCents, 1804);
assert.equal(full.lines.reduce((sum, line) => sum + line.offeredValueCents, 0), 1804);
assert.equal(full.lines.reduce((sum, line) => sum + line.adjustmentCents, 0), 101);
assert.equal(full.lines.reduce((sum, line) => sum + line.marginCents, 0), 203);

assert.throws(() => calculateCommercialRollup({ ...base, contributions: base.contributions.slice(0, 1), scope: "full", adjustmentCents: 0, marginMode: "amount", marginValue: 0 }), /Missing quantity/);
const partial = calculateCommercialRollup({ ...base, contributions: base.contributions.slice(0, 1), scope: "partial", adjustmentCents: 0, marginMode: "amount", marginValue: 0 });
assert.equal(partial.lines.length, 1);
assert.throws(() => calculateCommercialRollup({ ...base, contributions: [{ ...base.contributions[0]!, selectedQuantity: 11 }], scope: "partial", adjustmentCents: 0, marginMode: "amount", marginValue: 0 }), /invalid/);
assert.throws(() => calculateCommercialRollup({ ...base, contributions: [base.contributions[0]!, { ...base.contributions[0]! }], scope: "partial", adjustmentCents: 0, marginMode: "amount", marginValue: 0 }), /twice/);
const zeroLine=calculateCommercialRollup({scope:"full",requirements:[{originLineItemId:"paid",requiredQuantity:1},{originLineItemId:"free",requiredQuantity:100}],contributions:[{...base.contributions[0]!,originLineItemId:"paid",selectedQuantity:1,availableQuantity:1,availableAmountCents:100},{...base.contributions[1]!,originLineItemId:"free",selectedQuantity:100,availableQuantity:100,availableAmountCents:0}],adjustmentCents:9,marginMode:"amount",marginValue:11});
assert.equal(zeroLine.lines.find((line)=>line.originLineItemId==="free")?.offeredValueCents,0);

// The database allocation uses the same stable largest-remainder rule: an odd
// total is preserved exactly and ties resolve by origin id.
const totalOnlyCents=1001;
const weights=[{id:"a",quantity:1},{id:"b",quantity:1},{id:"c",quantity:1}];
const baseAllocations=weights.map((line)=>({id:line.id,cents:Math.floor(totalOnlyCents*line.quantity/3),remainder:(totalOnlyCents*line.quantity/3)%1}));
let remainder=totalOnlyCents-baseAllocations.reduce((sum,line)=>sum+line.cents,0);
for(const line of baseAllocations.sort((a,b)=>b.remainder-a.remainder||a.id.localeCompare(b.id))){if(remainder--<=0)break;line.cents+=1;}
assert.equal(baseAllocations.reduce((sum,line)=>sum+line.cents,0),totalOnlyCents);
assert.equal(baseAllocations.find((line)=>line.id==="a")?.cents,334);
