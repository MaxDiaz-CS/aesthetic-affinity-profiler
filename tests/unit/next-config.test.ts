import { expect, it } from "vitest";
import config from "../../next.config";

it("configures a static export", () => {
  expect(config.output).toBe("export");
});
