import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { quotationEntries, quotationPricingRows, quotationTotalCents } from "../projectQuotationRows";
import { replaceProjectQuotationEditingState, setProjectQuotationControlState, setProjectQuotationEditingMode, setProjectQuotationEditingPrices, type ProjectQuotationEditingState } from "../projectQuotationEditingState";
import { calculateProjectMargin, canManageProjectRfq, canOfferSellerCompletion, candidateCanSee, mapAwardRfqError, mapCreateRfqError, openRfqAvailability, quoteTotalToCents } from "../projectRfq";
import { parseSpineOriginAllocation } from "../spineOriginSpecification";
import { purchaseLegAllowsBuyerEdit, toEligiblePartyOption } from "../projectPartyOptions";
import { buildDefaultLegQuantities, buildLegWorkPackages, reconcileLegQuantities } from "../projectLegDraft";
import { parseCreateProjectLegInput } from "../projectLegValidation";

assert.equal(quoteTotalToCents(12.345), 1235);
assert.equal(quotationTotalCents("0"),0);
assert.equal(quotationTotalCents("12.34"),1234);
assert.equal(quotationTotalCents("12.345"),null);
const staleCandidate = { id: "candidate", organisationName: "Old", quoteEntries: [] } as unknown as ProjectQuotationEditingState["activeCandidate"];
const freshCandidate = { id: "candidate", organisationName: "Fresh", quoteEntries: [{ targetType: "process", targetId: "process", label: "Cutting", quantity: 1, unit: "m3", unitPriceCents: 2500 }] } as unknown as ProjectQuotationEditingState["activeCandidate"];
const editingBase: ProjectQuotationEditingState = { candidateId: "candidate", activeCandidate: staleCandidate, mode: "itemized", prices: {}, pending: false, canManage: true };
const editingFresh = replaceProjectQuotationEditingState(editingBase, { ...editingBase, activeCandidate: freshCandidate, prices: { "process:process": "25.00" } });
assert.equal(editingFresh.activeCandidate?.organisationName, "Fresh", "fresh same-ID server candidate replaces stale shared state");
assert.equal(editingFresh.prices["process:process"], "25.00", "fresh shared prices replace prior staged state");
const stagedPrices = setProjectQuotationEditingPrices(editingFresh, { "process:first": "6" });
assert.equal(stagedPrices.prices["process:first"], "6", "staged inline edits remain the shared source of truth");
assert.equal(stagedPrices.activeCandidate, editingFresh.activeCandidate, "staging a price does not replace the active candidate");
const stagedMode = setProjectQuotationEditingMode(stagedPrices, "itemized_total");
const clearedPrice = setProjectQuotationEditingPrices(stagedMode, { "process:first": "" });
assert.equal(clearedPrice.mode, "itemized_total", "clearing an inline price does not reset the selected pricing mode");
const afterControlPublish = setProjectQuotationControlState(clearedPrice, { candidateId: "candidate", activeCandidate: freshCandidate, pending: false, canManage: false });
assert.equal(afterControlPublish.prices["process:first"], "", "publishing card controls cannot overwrite staged provider prices");
assert.equal(afterControlPublish.mode, "itemized_total", "publishing card controls cannot overwrite the selected pricing mode");
assert.throws(() => quoteTotalToCents(-1));
assert.deepEqual(calculateProjectMargin(800000, "percentage", 20), {
  marginAmountCents: 200000,
  marginPercent: 20,
  salesAmountCents: 1000000,
});
assert.deepEqual(calculateProjectMargin(800000, "amount", 150000), {
  marginAmountCents: 150000,
  marginPercent: 15.7895,
  salesAmountCents: 950000,
});
assert.throws(() => calculateProjectMargin(800000, "percentage", 100));
assert.throws(() => calculateProjectMargin(800000, "percentage", 99.991));
assert.throws(() => calculateProjectMargin(800000, "amount", -1));
assert.equal(
  canManageProjectRfq({
    isPlatformAdmin: false,
    actorOrganisationId: "owner",
    ownerOrganisationId: "owner",
    lifecycleStage: "draft",
  }),
  true,
);
assert.equal(
  canManageProjectRfq({
    isPlatformAdmin: false,
    actorOrganisationId: "candidate",
    ownerOrganisationId: "owner",
    lifecycleStage: "draft",
  }),
  false,
);
assert.equal(
  canManageProjectRfq({
    isPlatformAdmin: true,
    actorOrganisationId: null,
    ownerOrganisationId: "owner",
    lifecycleStage: "confirmed",
  }),
  false,
);
assert.equal(candidateCanSee("supplier-a", "supplier-a"), true);
assert.equal(candidateCanSee("supplier-b", "supplier-a"), false);
assert.equal(openRfqAvailability({ data: { id: "rfq" }, error: null }), "open");
assert.equal(openRfqAvailability({ data: null, error: null }), "closed");
assert.equal(openRfqAvailability({ data: null, error: { message: "denied" } }), "unavailable");
assert.equal(
  canOfferSellerCompletion({
    isDraft: true,
    sellerMissing: true,
    openRfq: "open",
  }),
  false,
);
assert.equal(
  canOfferSellerCompletion({
    isDraft: true,
    sellerMissing: true,
    openRfq: "closed",
  }),
  true,
);
assert.deepEqual(mapCreateRfqError("RFQ_ALREADY_OPEN"), {
  error: "A quotation request cannot be opened for this leg",
  code: "CONFLICT",
});
assert.deepEqual(mapAwardRfqError("RFQ_EXPIRED"), {
  error: "The quotation deadline has passed",
  code: "CONFLICT",
});
assert.notEqual(mapCreateRfqError("opaque database detail").error, "opaque database detail");
assert.notEqual(mapAwardRfqError("opaque database detail").error, "opaque database detail");
const dualRole = {
  id: "dual",
  code: "DUA",
  name: "Dual",
  is_customer: true,
  is_trader: false,
  is_supplier: true,
  is_producer: false,
  is_manufacturer: false,
};
assert.equal(toEligiblePartyOption(dualRole, "buyer")?.group, "buyers");
assert.equal(toEligiblePartyOption(dualRole, "seller")?.group, "suppliers");
assert.equal(
  toEligiblePartyOption(
    {
      ...dualRole,
      id: "maker",
      is_customer: false,
      is_supplier: false,
      is_manufacturer: true,
    },
    "seller",
  )?.group,
  "suppliers",
);
assert.equal(
  purchaseLegAllowsBuyerEdit({
    isPlatformAdmin: true,
    dealKind: "purchase_only",
    buyerMissing: true,
  }),
  true,
);
assert.equal(
  purchaseLegAllowsBuyerEdit({
    isPlatformAdmin: true,
    dealKind: "purchase_only",
    buyerMissing: false,
  }),
  false,
);
assert.equal(
  purchaseLegAllowsBuyerEdit({
    isPlatformAdmin: false,
    dealKind: "purchase_only",
    buyerMissing: true,
  }),
  false,
);
assert.equal(
  purchaseLegAllowsBuyerEdit({
    isPlatformAdmin: false,
    dealKind: "buy_sell",
    buyerMissing: false,
  }),
  true,
);
assert.deepEqual(parseSpineOriginAllocation(null), {
  ok: false,
  error: "unavailable",
});
assert.deepEqual(
  parseSpineOriginAllocation([
    {
      originLineItemId: "line",
      lineNo: 1,
      productName: "Oak",
      unit: "m3",
      requiredQuantity: null,
      requestedQuantity: 0,
      awardedQuantity: 0,
      remainingQuantity: null,
    },
  ]),
  { ok: false, error: "unavailable" },
);
assert.equal(
  parseSpineOriginAllocation([
    {
      originLineItemId: "line",
      lineNo: 1,
      productName: "Oak",
      unit: "m3",
      requiredQuantity: 10,
      requestedQuantity: 4,
      awardedQuantity: 2,
      remainingQuantity: 8,
    },
  ]).ok,
  true,
);
const legAllocation = [
  {
    originLineItemId: "line",
    lineNo: 1,
    productName: "Oak",
    unit: "m3",
    requiredQuantity: 10,
    requestedQuantity: 4,
    awardedQuantity: 2,
    remainingQuantity: 8,
  },
];
assert.deepEqual(buildDefaultLegQuantities(legAllocation), { line: 8 });
assert.deepEqual(buildDefaultLegQuantities([{ ...legAllocation[0]!, remainingQuantity: 0 }]), {});
assert.deepEqual(buildLegWorkPackages(legAllocation, { line: 3 }), [{ originLineItemId: "line", quantity: 3 }]);
assert.deepEqual(buildLegWorkPackages(legAllocation, { line: Number.NaN }), []);
assert.deepEqual(buildLegWorkPackages(legAllocation, { line: 9 }), []);
assert.deepEqual(
  buildLegWorkPackages(
    [
      ...legAllocation,
      {
        ...legAllocation[0]!,
        originLineItemId: "second",
        remainingQuantity: 2,
      },
    ],
    { line: 9, second: 1 },
  ),
  [{ originLineItemId: "second", quantity: 1 }],
);
assert.deepEqual(reconcileLegQuantities(legAllocation, { line: 3 }), {
  line: 3,
});
assert.deepEqual(reconcileLegQuantities(legAllocation, { line: 99 }), {
  line: 8,
});
assert.deepEqual(reconcileLegQuantities(legAllocation, { line: 0 }), {
  line: 0,
});
assert.deepEqual(
  reconcileLegQuantities(
    [
      ...legAllocation,
      {
        ...legAllocation[0]!,
        originLineItemId: "second",
        remainingQuantity: 2,
      },
    ],
    { line: 3 },
  ),
  { line: 3, second: 2 },
);
const validUuid = "00000000-0000-4000-8000-000000000001";
assert.deepEqual(
  parseCreateProjectLegInput({
    sourceProjectId: validUuid,
    buyerOrganisationId: validUuid,
    sellerOrganisationId: null,
    workPackages: [],
  }),
  {
    success: false,
    error: "Select at least one available work package with a valid positive quantity",
    code: "VALIDATION_ERROR",
  },
);
const migration = readFileSync("../../supabase/migrations/20260826210000_project_supplier_rfqs.sql", "utf8");
const legoMigration = readFileSync("../../supabase/migrations/20260827120000_spine_lego_leg_rfq_award.sql", "utf8");
const stageIndependentRfqMigration = readFileSync("../../supabase/migrations/20260829003000_project_rfq_stage_independence.sql", "utf8");
const stageAutomationMigration = readFileSync("../../supabase/migrations/20260829004000_project_stage_automation.sql", "utf8");
const marginMigration = readFileSync("../../supabase/migrations/20260829010000_project_awarded_quotation_margin.sql", "utf8");
const rollupMigration = readFileSync("../../supabase/migrations/20260829130000_project_quotation_rollup_spine_gallery.sql", "utf8");
const emptyAdminQuoteMigration = readFileSync("../../supabase/migrations/20260901090000_admin_empty_quotation_correction.sql", "utf8");
const createDialog = readFileSync("src/features/projects/components/ProjectCreateLegDialog.tsx", "utf8");
assert.match(createDialog, /remainingQuantity>0/);
assert.match(createDialog, /Remaining quantities are selected by default/);
assert.match(createDialog, /workPackages\.length===0/);
assert.match(createDialog, /All specification quantities have already been allocated/);
const actions = readFileSync("src/features/projects/actions/projectRfqActions.ts", "utf8");
const editor = readFileSync("src/features/projects/components/ProjectSpecificationEditor.tsx", "utf8");
const specificationTables = readFileSync("src/features/projects/components/ProjectSpecificationTables.tsx", "utf8");
const quoteRows = readFileSync("src/features/projects/services/projectQuotationRows.ts", "utf8");
assert.match(migration, /project_rfq_candidates_select/);
assert.match(migration, /FOR UPDATE/);
assert.match(migration, /status=CASE WHEN id=c\.id THEN 'awarded' ELSE 'not_awarded'/);
assert.match(migration, /get_project_rfq_candidate_snapshot/);
assert.doesNotMatch(migration, /CREATE POLICY orders_rfq_candidate_select/);
assert.doesNotMatch(migration, /CREATE POLICY order_lines_rfq_candidate_select/);
assert.match(migration, /r\.deadline>now\(\)/);
assert.match(migration, /UPDATE public\.orders SET upstream_deal_id=v_leg WHERE id=o\.id/);
assert.doesNotMatch(migration, /INSERT INTO public\.orders\(id,code,name,organisation_id,/);
assert.match(migration, /INSERT INTO public\.orders\([^)]*customer_organisation_id,seller_organisation_id,buyer_organisation_id/);
assert.match(migration, /current_user_can_create_deal_in_org/);
assert.doesNotMatch(editor, /Unit price|Margin|Cost build-up|unitPrice/);
assert.match(quoteRows, /quotationEntries/);
assert.match(quoteRows, /targetType: "line"/);
assert.match(quoteRows, /targetType: "process"/);
assert.match(quoteRows, /unitPriceCents: Math\.round\(unitPrice \* 100\)/);
assert.match(emptyAdminQuoteMigration, /jsonb_array_length\(p_entries\) NOT BETWEEN 0 AND 500/);
assert.match(emptyAdminQuoteMigration, /is_current_user_platform_admin/);
assert.match(actions, /adminQuoteSchema/);
const quotationLine = { id:"11111111-1111-4111-8111-111111111111", lineNo:1, productName:"Metal", volumeM3:null, pieces:"2", unit:"kg", processRequirements:[] } as any;
assert.deepEqual(quotationEntries([quotationLine], { [`line:${quotationLine.id}`]: "" }), [], "blank quotation prices are not persisted as zero");
assert.equal(quotationEntries([quotationLine], { [`line:${quotationLine.id}`]: "12.50" })[0]?.unitPriceCents, 1250);
const materialProcessLine = { ...quotationLine, processRequirements:[{ id:"22222222-2222-4222-8222-222222222222",fieldKey:"metal",name:"Material",value:"1005.07",unit:"kg",active:true }] } as any;
assert.deepEqual(quotationPricingRows([materialProcessLine]).map((row) => row.targetType), ["process"], "Material process replaces the duplicate line-level price");
const zeroQuantityProcessLine = { ...quotationLine, processRequirements:[{ id:"33333333-3333-4333-8333-333333333333",fieldKey:"cutting",name:"Cutting",value:"0",unit:"m³",active:true }] } as any;
assert.deepEqual(quotationPricingRows([zeroQuantityProcessLine]).map((row) => ({ targetType:row.targetType,quantity:row.quantity })), [{ targetType:"line",quantity:2 },{ targetType:"process",quantity:0 }], "Active zero-quantity processes remain quoteable");
const nonCanonicalProcessLines = ["", "   ", "1e2", "-0", "+1"].map((value,index) => ({ ...quotationLine, id:`44444444-4444-4444-8444-44444444444${index}`, processRequirements:[{ id:`55555555-5555-4555-8555-55555555555${index}`,fieldKey:"cutting",name:"Cutting",value,unit:"m³",active:true }] })) as any;
assert.deepEqual(quotationPricingRows(nonCanonicalProcessLines).filter((row) => row.targetType === "process"), [], "Non-canonical process quantities are not quoteable");
assert.match(legoMigration, /deal_kind IN \('buy_sell','sale_only'\)/);
assert.match(legoMigration, /origin_line_item_id/);
assert.match(legoMigration, /unit_price_cents,line_total_cents[\s\S]*NULL,NULL/);
assert.match(legoMigration, /ORDER BY origin\.id FOR UPDATE/);
assert.match(legoMigration, /ORDER BY wp\.origin_line_item_id,wp\.id FOR UPDATE/);
assert.match(legoMigration, /IF r\.deadline<=now\(\) THEN RAISE EXCEPTION 'RFQ_EXPIRED'/);
assert.match(legoMigration, /SELECT \* INTO o FROM public\.orders WHERE id=r\.order_id FOR UPDATE;[\s\S]*pg_advisory_xact_lock[\s\S]*ORDER BY origin\.id FOR UPDATE/);
assert.match(legoMigration, /ORIGIN_QUANTITY_UNAVAILABLE/);
assert.doesNotMatch(legoMigration, /origin\.volume_m3[\s\S]{0,180},1\)/);
assert.match(legoMigration, /orders_one_legacy_outgoing_leg_per_spine_buyer[\s\S]*NOT is_manual_spine_leg/);
assert.match(legoMigration, /SELECT spine_id INTO v_spine[\s\S]*pg_advisory_xact_lock[\s\S]*WHERE id=p_source_order_id FOR UPDATE[\s\S]*SOURCE_NOT_DRAFT/);
assert.match(legoMigration, /is_manual_spine_leg[\s\S]*public\.current_portal_user_id\(\),true/);
assert.match(legoMigration, /CREATE OR REPLACE FUNCTION public\.create_project_rfq[\s\S]*WORK_PACKAGE_REQUIRED/);
assert.match(legoMigration, /UPDATE public\.orders SET seller_organisation_id=c\.organization_id/);
assert.doesNotMatch(legoMigration, /award_project_rfq[\s\S]*INSERT INTO public\.orders/);
assert.match(legoMigration, /conrelid = 'public\.order_line_items'::regclass/);
assert.match(legoMigration, /complete_project_leg_party/);
assert.match(createDialog, /DialogDescription/);
assert.match(createDialog, /defaultBuyerId/);
assert.match(actions, /lookupError \|\| !rfq/);
assert.match(stageIndependentRfqMigration, /create_project_rfq stage anchor missing/);
assert.match(stageIndependentRfqMigration, /award_project_rfq stage anchor missing/);
assert.match(stageIndependentRfqMigration, /IF NOT FOUND THEN RAISE EXCEPTION ''LEG_NOT_FOUND''/);
assert.match(stageAutomationMigration, /lifecycle_stage=''request_for_quotation''/);
assert.match(stageAutomationMigration, /lifecycle_stage=''awarded''/);
assert.match(stageAutomationMigration, /create_project_rfq return anchor missing/);
assert.match(stageAutomationMigration, /award_project_rfq update anchor missing/);
assert.match(marginMigration, /set_project_awarded_margin/);
assert.match(marginMigration, /current_user_in_org\(v_order\.buyer_organisation_id\)/);
assert.match(marginMigration, /rfq\.status = 'awarded'/);
assert.match(marginMigration, /margin_amount_cents = v_margin[\s\S]*resale_value_cents = v_sales/);
assert.doesNotMatch(marginMigration, /UPDATE public\.orders SET\s+value_cents\s*=/);
const rfqCard = readFileSync("src/features/projects/components/ProjectRfqCard.tsx", "utf8");
const commercialAction = readFileSync("src/features/projects/actions/projectCommercialActions.ts", "utf8");
const commercialCard = readFileSync("src/features/projects/components/ProjectCommercialRollup.tsx", "utf8");
assert.match(rfqCard, /Quotation requests created[\s\S]*router\.refresh\(\)/);
assert.match(rfqCard, /Trader margin/);
assert.match(rfqCard, /Gross margin/);
assert.match(actions, /canManage&&row\.status==="awarded"/);
assert.match(actions, /saveProjectAwardedMargin/);
assert.match(rollupMigration, /source\.buyer_organisation_id = target\.seller_organisation_id|s\.buyer_organisation_id=target\.seller_organisation_id/);
assert.match(rollupMigration, /current_user_can_create_deal_in_org\(p_order\.seller_organisation_id\)/);
assert.match(rollupMigration, /x\.is_active AND x\.is_trader/);
assert.match(rollupMigration, /commercial_offer_scope[\s\S]*full[\s\S]*partial/);
assert.match(rollupMigration, /STALE_OR_INVALID_SOURCE/);
assert.match(rollupMigration, /INCOMPLETE_COVERAGE line=% missing_quantity=%/);
assert.match(rollupMigration, /OVER_COVERAGE/);
assert.match(rollupMigration, /CIRCULAR_SOURCE/);
assert.match(rollupMigration, /WITH RECURSIVE affected/);
assert.match(rollupMigration, /coalesce\(l\.origin_line_item_id,l\.id\) origin_id/);
assert.match(rollupMigration, /sum\(coalesce\(l\.work_package_quantity,public\.project_origin_required_quantity/);
assert.match(rollupMigration, /CREATE TEMP TABLE target_requirements/);
assert.match(rollupMigration, /pg_advisory_xact_lock\(hashtextextended/);
assert.match(rollupMigration, /commercial_margin_mode=p_margin_mode/);
assert.match(rollupMigration, /CASE WHEN EXISTS\(SELECT 1 FROM rollup_lines WHERE cost>0\) THEN cost ELSE qty END/);
assert.match(rollupMigration, /source->>'currency' IS DISTINCT FROM target\.currency/);
assert.match(rollupMigration, /spine_project_images/);
assert.match(rollupMigration, /PARTITION BY o\.spine_id,f\.storage_path/);
assert.match(rollupMigration, /p_action='add' AND NOT EXISTS/);
assert.doesNotMatch(rollupMigration, /UPDATE public\.order_files SET order_id/);
assert.match(rollupMigration, /correct_project_rfq_quote_entries/);
assert.match(rollupMigration, /commercial_confirmed_at IS NULL AND resale_value_cents IS NULL/);
assert.doesNotMatch(rollupMigration, /correct_project_rfq_quote_entries[\s\S]*margin_amount_cents\s*=\s*NULL/);
assert.match(rollupMigration, /t\.side='sell'/);
assert.match(rollupMigration, /CREATE OR REPLACE FUNCTION public\.set_project_awarded_margin/);
assert.match(rollupMigration, /commercial_rollup_state='confirmed'[\s\S]*commercial_margin_mode=p_mode[\s\S]*commercial_version=commercial_version\+1/);
assert.doesNotMatch(commercialAction, /error\.message\.replaceAll/);
assert.match(commercialAction, /mapRollupError/);
assert.match(commercialAction, /commercial_rollup_state==="confirmed"[\s\S]*sourceCount/);
assert.match(commercialAction, /canViewPrivate=canBuild/);
assert.match(commercialAction, /state:canViewOffer\?/);
assert.match(commercialAction, /project_rfqs_awarded_candidate_fk/);
assert.match(commercialCard, /calculateCommercialRollup/);
assert.match(commercialCard, /useState\(false\)/);
assert.match(commercialCard, /Configure offer/);
assert.match(commercialCard, /Buyer total/);
assert.match(commercialCard, /marginPercent\.toFixed\(2\)/);
assert.match(commercialCard, /useEffect\(\(\) => setOpen\(false\), \[projectId\]\)/);
assert.match(commercialCard, /controls=\{bodyId\}/);
assert.match(commercialCard, /Purchase:[\s\S]*Additional:[\s\S]*Margin:[\s\S]*Total:/);
assert.match(commercialCard, /catch\(\(\)\s*=>\s*setLoadError\("Could not load commercial offer"\)\)/);
assert.doesNotMatch(rfqCard, /find\(\(candidate\)=>candidate\.id===viewCandidateId\)!/);
assert.match(rfqCard, /View quotation/);
const pricingModeMigration = readFileSync("../../supabase/migrations/20260901170000_project_quotation_pricing_mode.sql", "utf8");
const processQuotationColumnFix = readFileSync("../../supabase/migrations/20260902140000_fix_process_quotation_active_column.sql", "utf8");
const processTotalPricingMigration = readFileSync("../../supabase/migrations/20260901200000_shared_specification_and_process_total_pricing.sql", "utf8");
const supplierDirectQuotationMigration = readFileSync("../../supabase/migrations/20260902120000_supplier_direct_quotation.sql", "utf8");
const zeroQuantityProcessMigration = readFileSync("../../supabase/migrations/20260902130000_zero_quantity_process_quotation.sql", "utf8");
assert.match(pricingModeMigration, /pricing_mode IN \('itemized','total'\)/);
assert.match(pricingModeMigration, /MIXED_OR_INVALID_TOTAL/);
assert.match(pricingModeMigration, /project_quote_origin_allocations/);
assert.match(pricingModeMigration, /remainder DESC,origin_id/);
assert.match(pricingModeMigration, /INCONSISTENT_QUOTATION/);
assert.match(pricingModeMigration, /DROP FUNCTION IF EXISTS public\.submit_project_rfq_quote_entries\(UUID,JSONB,TEXT\)/);
assert.match(pricingModeMigration, /DROP FUNCTION IF EXISTS public\.correct_project_rfq_quote_entries\(UUID,JSONB,TEXT\)/);
assert.match(processQuotationColumnFix, /pr\.is_active=true/, "quotation normalization uses the canonical process applicability column");
assert.doesNotMatch(processQuotationColumnFix, /pr\.active\b/, "quotation normalization never references the nonexistent process active column");
assert.match(pricingModeMigration, /coalesce\(quote_entries,'null'::jsonb\)='\[\]'::jsonb/);
assert.match(pricingModeMigration, /p_total_cents>9007199254740991/);
assert.match(pricingModeMigration, /total>9007199254740991/);
assert.match(pricingModeMigration, /JOIN public\.project_rfqs r ON r\.id=c\.rfq_id WHERE c\.id=p_candidate_id AND r\.order_id=p_order_id/);
assert.match(pricingModeMigration, /INVALID_ALLOCATION_QUANTITY/);
assert.match(pricingModeMigration, /CREATE CONSTRAINT TRIGGER enforce_total_project_source_whole_package/);
assert.match(pricingModeMigration, /DEFERRABLE INITIALLY DEFERRED/);
assert.doesNotMatch(pricingModeMigration, /pg_get_functiondef|changed:=replace/);
assert.match(actions, /pricingMode:z\.enum\(\["itemized","itemized_total","total"\]\)/);
assert.match(actions, /p_total_cents:parsed\.data\.totalCents/);
assert.match(rfqCard, /Unit price for each process/);
assert.match(rfqCard, /Total for each process/);
assert.match(rfqCard, /One total for all processes/);
assert.match(processTotalPricingMigration, /pricing_mode IN \('itemized','itemized_total','total'\)/);
assert.match(processTotalPricingMigration, /normalize_project_quote_entry_totals/);
assert.match(processTotalPricingMigration, /c\.pricing_mode='itemized_total'/);
assert.doesNotMatch(rfqCard, /Changing pricing mode replaces/);
assert.match(rfqCard, /Enter .* in the Applicable processes tables/);
assert.equal((rfqCard.match(/<th className="p-2">Requirement<\/th>/g) ?? []).length, 1, "only the read-only quotation detail keeps a requirement table");
assert.match(rfqCard, /Legacy quotation — pricing mode not recorded/);
assert.match(supplierDirectQuotationMigration, /is_current_user_platform_admin\(\) OR public\.current_user_in_org\(leg\.seller_organisation_id\)/);
assert.match(supplierDirectQuotationMigration, /leg\.deleted_at IS NOT NULL/);
assert.match(supplierDirectQuotationMigration, /ASSIGNED_SELLER_REQUIRED/);
assert.match(supplierDirectQuotationMigration, /SELF_DEAL/);
assert.match(supplierDirectQuotationMigration, /SELLER_INELIGIBLE/);
assert.match(actions, /project\.data\.seller\.id!==a\.orgId/);
assert.match(rfqCard, /canInitializeOwnQuotation/);
assert.match(rfqCard, /Create quotation/);
assert.match(actions, /quantity:z\.coerce\.number\(\)\.finite\(\)\.nonnegative\(\)/);
assert.match(actions, /entry\.targetType==="line"&&entry\.quantity<=0/);
assert.match(zeroQuantityProcessMigration, /qty<0 OR \(typ='line' AND qty=0\)/);
assert.match(zeroQuantityProcessMigration, /price>2147483647/);
assert.match(zeroQuantityProcessMigration, /pr\.active=true/);
assert.match(specificationTables, /disabled=\{!active \|\| quotation\.pending \|\| saveStatus === "saving" \|\| saveStatus === "error"\}/);
assert.match(specificationTables, /if \(!quoteCanManage\) return/);
assert.match(specificationTables, /const selectedCandidate = sharedQuotation\.activeCandidate/);
assert.doesNotMatch(specificationTables, /getProjectRfqState/);
const detailView = readFileSync("src/features/projects/components/ProjectDetailView.tsx", "utf8");
assert.match(detailView, /canEnterQuotation=\{viewer\.isPlatformAdmin \|\| viewerIsSeller\}/);
assert.doesNotMatch(detailView, /canEnterQuotation=\{viewer\.isPlatformAdmin \|\| \(isRfqCandidate && viewerIsSeller\)\}/);
assert.ok(detailView.indexOf("<ProjectRfqCard") < detailView.indexOf("<ProjectSpecificationEditor"), "Supplier quotations render above Technical specification");
assert.match(rfqCard, /if \(loadFailed\).*Quotation details could not be loaded/);
assert.match(rfqCard, /toast\.success\("Quotation created"\);[\s\S]{0,80}router\.refresh\(\);/);
assert.match(rfqCard, /Create and submit your quotation for this project/);
console.log("projectRfq.test.ts: passed");
