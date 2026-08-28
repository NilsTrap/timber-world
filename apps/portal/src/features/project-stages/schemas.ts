import { z } from "zod";

const stageKey = z.string().trim().regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, numbers, and underscores").max(50);
const label = z.string().trim().min(1, "Label is required").max(80);
const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a six-digit hex colour");

export const createProjectStageSchema = z.object({
  key: stageKey,
  label,
  color,
  isActive: z.boolean().default(true),
  availableToBuyer: z.boolean(),
  availableToTrader: z.boolean(),
  availableToSupplier: z.boolean(),
});

export const updateProjectStageDefinitionSchema = createProjectStageSchema.omit({ key: true }).extend({
  key: stageKey,
  updatedAt: z.string().datetime({ offset: true }),
});

export const reorderProjectStagesSchema = z.object({
  items: z.array(z.object({ key: stageKey, sortOrder: z.number().int().min(0) })).min(1)
    .refine((items) => new Set(items.map((item) => item.key)).size === items.length, "Stage keys must be unique")
    .refine((items) => new Set(items.map((item) => item.sortOrder)).size === items.length, "Stage positions must be unique"),
});

export const updateProjectStageSchema = z.object({
  projectId: z.string().uuid(),
  stageKey,
  expectedUpdatedAt: z.string().datetime({ offset: true }),
});

export type CreateProjectStageInput = z.infer<typeof createProjectStageSchema>;
export type UpdateProjectStageDefinitionInput = z.infer<typeof updateProjectStageDefinitionSchema>;
