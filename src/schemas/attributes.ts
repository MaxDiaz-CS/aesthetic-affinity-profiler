import { z } from "zod";

export const attributeIds = [
  "palette_temperature",
  "saturation",
  "lightness",
  "ornament",
  "geometry",
  "surface",
  "texture",
  "material",
  "time_orientation",
  "tone",
  "status",
  "context",
  "imagery",
  "typography",
] as const;

export const attributeIdSchema = z.enum(attributeIds);
export const attributeScoreSchema = z.number().int().min(-2).max(2);

const attributeSchema = z.strictObject({
  id: attributeIdSchema,
  label: z.string().min(1),
  low: z.string().min(1),
  high: z.string().min(1),
});

export const attributesSchema = z.array(attributeSchema).length(attributeIds.length)
  .refine(
    (attributes) => attributes.every((attribute, index) => attribute.id === attributeIds[index]),
    "Attributes must follow the 14 IDs in the order specified in the white paper.",
  );
