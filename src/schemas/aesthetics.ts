import { z } from "zod";
import { attributeIdSchema, attributeScoreSchema } from "./attributes.ts";

const cariBaseUrl = "https://cari.institute/aesthetics/";
const labelSchema = z.string().min(1);
const labelListSchema = z.array(labelSchema);
export const aestheticSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const revealSchema = z.strictObject({
  icon_url: z.url().nullable(),
  namesake: labelSchema.nullable(),
  description: labelSchema.nullable(),
  alt_names: labelListSchema.nullable(),
  coined_by: labelSchema.nullable(),
  researched_by: labelSchema.nullable(),
  related: z.array(aestheticSlugSchema).nullable(),
  gallery: labelListSchema.nullable(),
});

const codesSchema = z.record(attributeIdSchema, attributeScoreSchema);

const aestheticSchema = z.strictObject({
  slug: aestheticSlugSchema,
  name: labelSchema,
  cari_url: z.url(),
  decade: z.string().regex(/^\d{3}0s$/).nullable(),
  period: labelSchema.nullable(),
  codes: codesSchema.nullable(),
  code_source: z.enum(["illustrative", "ai_draft", "rated", "uncoded"]),
  signature_cues: labelListSchema,
  reveal: revealSchema,
})
  .refine(({ slug, cari_url }) => cari_url === cariBaseUrl + slug, {
    path: ["cari_url"],
    message: "Must equal the CARI aesthetics URL followed by this slug.",
  })
  .refine(({ codes, code_source }) => (codes === null) === (code_source === "uncoded"), {
    path: ["codes"],
    message: "Codes must be null exactly when code_source is uncoded.",
  });

export const aestheticsSchema = z.array(aestheticSchema).length(90).refine(
  (aesthetics) => new Set(aesthetics.map(({ slug }) => slug)).size === aesthetics.length,
  "Aesthetic slugs must be unique.",
);
