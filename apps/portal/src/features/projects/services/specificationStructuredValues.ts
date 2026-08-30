import { z } from "zod";

const key = z.string().trim().min(1).max(100);
const value = z.string().max(500);

export const structuredSpecificationValuesSchema = z.object({
  projectId: z.string().uuid(),
  lineId: z.string().uuid(),
  version: z.string().datetime({ offset: true }),
  basicValues: z.array(z.object({ key, value })).max(200),
  processValues: z.array(z.object({
    key,
    value: value.refine((input) => /^(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(input), "Process quantity must be zero or greater"),
  })).max(200),
}).superRefine((input, context) => {
  for (const group of [input.basicValues, input.processValues]) {
    const seen = new Set<string>();
    for (const item of group) {
      if (seen.has(item.key)) context.addIssue({ code: "custom", message: `Duplicate field ${item.key}` });
      seen.add(item.key);
    }
  }
});

export type StructuredSpecificationValues = z.infer<typeof structuredSpecificationValuesSchema>;

export function structuredSpecificationPayload(input: StructuredSpecificationValues) {
  return {
    p_order_id: input.projectId,
    p_line_id: input.lineId,
    p_version: input.version,
    p_basic_values: input.basicValues,
    p_process_values: input.processValues,
  };
}
