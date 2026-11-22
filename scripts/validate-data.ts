import { readFileSync } from "node:fs";
import type { ZodType } from "zod";
import { aestheticsSchema } from "../src/schemas/aesthetics.ts";
import { attributesSchema } from "../src/schemas/attributes.ts";
import { scenariosSchema } from "../src/schemas/scenarios.ts";
import { slidersSchema } from "../src/schemas/sliders.ts";
import { stimuliSchema } from "../src/schemas/stimuli.ts";

function loadData<T>(file: string, schema: ZodType<T>): T {
  try {
    const content = readFileSync(new URL(`../data/${file}`, import.meta.url), "utf8");
    return schema.parse(JSON.parse(content));
  } catch (error) {
    throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

loadData("attributes.json", attributesSchema);
const aesthetics = loadData("aesthetics.json", aestheticsSchema);
loadData("sliders.json", slidersSchema);
loadData("scenarios.json", scenariosSchema);
const stimuli = loadData("stimuli.json", stimuliSchema);

const knownSlugs = new Set(aesthetics.map(({ slug }) => slug));
const unknownStimulus = stimuli.find(({ slug }) => !knownSlugs.has(slug));
if (unknownStimulus) {
  throw new Error(`stimuli.json: ${unknownStimulus.id} references unknown slug ${unknownStimulus.slug}`);
}

console.log("Validated all five data files.");
