import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canViewerSelectStage } from "./reads";
import { createProjectStageSchema, reorderProjectStagesSchema, updateProjectStageDefinitionSchema } from "./schemas";
import type { StageOption } from "./types";

const stage: StageOption = {
  key: "request_for_quotation", label: "Request for quotation", color: "#D97706", sortOrder: 30,
  isActive: true, availableToBuyer: true, availableToTrader: true,
  availableToSupplier: false, updatedAt: "2026-08-28T00:00:00.000Z",
};

assert.equal(canViewerSelectStage(stage, { isPlatformAdmin: false, personas: ["buyer"] }), true);
assert.equal(canViewerSelectStage(stage, { isPlatformAdmin: false, personas: ["supplier"] }), false);
assert.equal(canViewerSelectStage(stage, { isPlatformAdmin: false, personas: ["supplier", "trader"] }), true);
assert.equal(canViewerSelectStage({ ...stage, isActive: false }, { isPlatformAdmin: true, personas: [] }), false);
assert.equal(createProjectStageSchema.safeParse({key:"Bad Key",label:"Bad",color:"red",isActive:true,availableToBuyer:true,availableToTrader:true,availableToSupplier:true}).success,false);
assert.equal(updateProjectStageDefinitionSchema.safeParse({key:"draft",label:"Draft",color:"#64748B",isActive:true,availableToBuyer:true,availableToTrader:true,availableToSupplier:false,updatedAt:"2026-08-28T00:00:00.000Z"}).success,true);
assert.equal(reorderProjectStagesSchema.safeParse({items:[{key:"draft",sortOrder:10},{key:"confirmed",sortOrder:10}]}).success,false);

const migration = readFileSync("../../supabase/migrations/20260828100000_project_stages.sql", "utf8");
assert.match(migration, /conrelid = 'public\.orders'::regclass/);
assert.match(migration, /FOREIGN KEY \(lifecycle_stage\) REFERENCES public\.project_stages\(key\)/);
assert.match(migration, /PROJECT_STAGE_FORBIDDEN/);
assert.match(migration, /TG_OP = 'UPDATE'/);
assert.match(migration, /BEFORE INSERT OR UPDATE OF lifecycle_stage/);
assert.match(migration, /is_current_user_platform_admin\(\).*RETURN NEW/);
assert.match(migration, /reorder_project_stages/);
assert.match(migration, /INCOMPLETE_STAGE_ORDER/);
assert.match(migration, /UNIQUE\(sort_order\) DEFERRABLE/);
assert.match(migration, /LOCK TABLE public\.project_stages IN SHARE ROW EXCLUSIVE MODE/);
assert.match(migration, /\('specification',\s+'Specification'/);
assert.match(migration, /\('request_for_quotation',\s+'Request for quotation'/);
assert.match(migration, /\('quotation_review',\s+'Quotation review'/);
assert.match(migration, /\('ready_for_dispatch',\s+'Ready for dispatch'/);
assert.match(migration, /\('in_transit',\s+'In transit'/);
assert.match(migration, /LEFT JOIN public\.project_stages ps/);
assert.match(migration, /ORDER BY COALESCE\(ps\.sort_order/);

const detail = readFileSync("src/features/projects/components/ProjectDetailView.tsx", "utf8");
const selector = readFileSync("src/features/projects/components/ProjectStatusSelect.tsx", "utf8");
const nav = readFileSync("src/components/layout/navItems.ts", "utf8");
assert.match(detail, /actions={<><ProjectStatusSelect[\s\S]*<ProjectNextLegControl/);
assert.doesNotMatch(detail, /badge={<ProjectStageBadge/);
assert.match(selector, /className="h-8 min-w-36"/);
assert.match(selector, /expectedUpdatedAt/);
assert.match(nav, /\/admin\/settings\/project-stages/);

console.log("project stages: pure and migration contracts passed");
