import { z } from "zod";
import { attributeIdSchema, attributeScoreSchema } from "./attributes.ts";

const scenarioOptionSchema = z.strictObject({
  id: z.enum(["a", "b", "c", "d"]),
  label: z.string().min(1),
  image: z.string().min(1).nullable(),
  vector: z.partialRecord(attributeIdSchema, attributeScoreSchema),
});

const scenarioSchema = z.strictObject({
  id: z.string().min(1),
  prompt: z.string().min(1),
  options: z.array(scenarioOptionSchema).length(4).refine(
    (options) => new Set(options.map(({ id }) => id)).size === options.length,
    "Scenario option IDs must be unique within the scenario.",
  ),
});

export const scenariosSchema = z.array(scenarioSchema).length(8).refine(
  (scenarios) => new Set(scenarios.map(({ id }) => id)).size === scenarios.length,
  "Scenario IDs must be unique.",
);
