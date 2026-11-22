import { z } from "zod";
import { aestheticSlugSchema } from "./aesthetics.ts";

const stimulusSchema = z.strictObject({
  id: z.string().min(1),
  slug: aestheticSlugSchema,
  pool: z.enum(["quiz", "reveal"]),
  pinterest_pin_url: z.null(),
  image_url: z.null(),
  alt_text: z.string(),
  source_url: z.null(),
  credit: z.null(),
  status: z.literal("placeholder"),
});

export const stimuliSchema = z.array(stimulusSchema).refine(
  (stimuli) => new Set(stimuli.map(({ id }) => id)).size === stimuli.length,
  "Stimulus IDs must be unique.",
);
