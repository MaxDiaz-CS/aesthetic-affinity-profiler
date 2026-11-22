import { z } from "zod";
import { attributeIdSchema, attributeIds } from "./attributes.ts";

const repeatAttributes = ["surface", "lightness"] as const;
const sliderIdSchema = z.string().min(1);
const poleSchema = z.strictObject({
  label: z.string().min(1),
  image: z.string().min(1).nullable(),
});

const sliderSchema = z.strictObject({
  id: sliderIdSchema,
  attribute: attributeIdSchema,
  prompt: z.string().min(1),
  left: poleSchema,
  right: poleSchema,
  repeat_of: sliderIdSchema.nullable(),
});

export const slidersSchema = z.array(sliderSchema)
  .length(attributeIds.length + repeatAttributes.length)
  .superRefine((sliders, ctx) => {
    const originals = sliders.filter(({ repeat_of }) => repeat_of === null);
    const repeats = sliders.filter(({ repeat_of }) => repeat_of !== null);

    if (new Set(sliders.map(({ id }) => id)).size !== sliders.length) {
      ctx.addIssue({ code: "custom", message: "Slider IDs must be unique." });
    }
    if (originals.length !== attributeIds.length ||
        new Set(originals.map(({ attribute }) => attribute)).size !== attributeIds.length) {
      ctx.addIssue({ code: "custom", message: "Include one original slider per attribute." });
    }
    if (repeats.length !== repeatAttributes.length ||
        !repeatAttributes.every((attribute) => repeats.some((item) => item.attribute === attribute))) {
      ctx.addIssue({ code: "custom", message: "Include one repeat each for surface and lightness." });
    }

    for (const repeat of repeats) {
      const original = originals.find(({ id }) => id === repeat.repeat_of);
      if (!original || original.attribute !== repeat.attribute ||
          original.left.label !== repeat.right.label || original.left.image !== repeat.right.image ||
          original.right.label !== repeat.left.label || original.right.image !== repeat.left.image) {
        ctx.addIssue({
          code: "custom",
          path: [sliders.indexOf(repeat), "repeat_of"],
          message: "A repeat must point to its original slider and swap both pole boards.",
        });
      }
    }
  });
