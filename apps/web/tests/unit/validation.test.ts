import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { validate } from "../../src/shared/validation";

describe("validate", () => {
  const schema = z.object({
    name: z.string({ error: "Enter a name." }).min(1, { error: "Enter a name." }).max(3, { error: "Too long." }),
    count: z.number({ error: "Enter a number." }),
  });

  test("returns the parsed data", () => {
    expect(validate(schema, { name: "ab", count: 2 })).toEqual({ success: true, data: { name: "ab", count: 2 } });
  });

  test("keeps the first message per field and reads non-objects as {}", () => {
    expect(validate(schema, "nope")).toEqual({
      success: false,
      error: { name: "Enter a name.", count: "Enter a number." },
    });
  });
});
