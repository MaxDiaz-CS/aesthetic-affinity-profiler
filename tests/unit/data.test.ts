import { describe, expect, it } from "vitest";
import aesthetics from "../../data/aesthetics.json";
import attributes from "../../data/attributes.json";
import scenarios from "../../data/scenarios.json";
import sliders from "../../data/sliders.json";
import stimuli from "../../data/stimuli.json";
import { aestheticsSchema } from "../../src/schemas/aesthetics.ts";
import { attributesSchema } from "../../src/schemas/attributes.ts";
import { scenariosSchema } from "../../src/schemas/scenarios.ts";
import { slidersSchema } from "../../src/schemas/sliders.ts";
import { stimuliSchema } from "../../src/schemas/stimuli.ts";

describe("catalog data", () => {
  it("labels all 90 codes and leaves every reveal field null", () => {
    const catalog = aestheticsSchema.parse(aesthetics);
    expect(catalog.filter(({ code_source }) => code_source === "illustrative").map(({ slug }) => slug))
      .toEqual(["frutiger-aero", "global-village-coffeehouse", "whimsigothic"]);
    expect(catalog.filter(({ code_source }) => code_source === "ai_draft")).toHaveLength(87);
    expect(catalog.every(({ reveal }) => Object.values(reveal).every((value) => value === null)))
      .toBe(true);
  });

  it("rejects duplicate slugs, misplaced CARI URLs and invalid code vectors", () => {
    const catalog = aestheticsSchema.parse(aesthetics);
    const [first, ...rest] = catalog;
    if (first.codes === null) throw new Error("The fixture must have codes.");

    const replaceFirst = (changes: Partial<typeof first>) =>
      aestheticsSchema.safeParse([{ ...first, ...changes }, ...rest]).success;

    expect(replaceFirst(rest[0])).toBe(false);
    expect(replaceFirst({ cari_url: first.cari_url + "/" })).toBe(false);
    expect(replaceFirst({ codes: null })).toBe(false);
    expect(replaceFirst({ codes: { ...first.codes, surface: 0.5 } })).toBe(false);
    expect(replaceFirst({ codes: { ...first.codes, surface: 3 } })).toBe(false);

    const { surface: omitted, ...incomplete } = first.codes;
    expect(omitted).toBeDefined();
    expect(aestheticsSchema.safeParse([{ ...first, codes: incomplete }, ...rest]).success)
      .toBe(false);
  });
});

describe("question and stimulus data", () => {
  it("validates the 14 attributes, 16 sliders and 32 scenario options", () => {
    expect(attributesSchema.parse(attributes)).toHaveLength(14);
    const validSliders = slidersSchema.parse(sliders);
    const validScenarios = scenariosSchema.parse(scenarios);
    expect(validSliders).toHaveLength(16);
    expect(validScenarios).toHaveLength(8);
    expect(validSliders.every(({ left, right }) => left.image === null && right.image === null))
      .toBe(true);
    expect(validScenarios.flatMap(({ options }) => options).map(({ image }) => image))
      .toEqual(Array(32).fill(null));
  });

  it("uses three quiz and six reveal placeholders per aesthetic", () => {
    const entries = stimuliSchema.parse(stimuli);
    expect(entries).toHaveLength(810);
    for (const { slug } of aesthetics) {
      const board = entries.filter((entry) => entry.slug === slug);
      expect(board.filter(({ pool }) => pool === "quiz")).toHaveLength(3);
      expect(board.filter(({ pool }) => pool === "reveal")).toHaveLength(6);
    }
  });
});
