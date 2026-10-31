import { describe, expect, test } from "bun:test";
import { requiredAssurance, riskScore } from "../../lib/risk";

describe("risk", () => {
  test("a clean browser is invisible, whatever DevTools is doing", () => {
    expect(requiredAssurance("invisible", riskScore({ signals: { solveMs: 900 }, highVelocity: false }))).toBe(
      "invisible",
    );
    expect(requiredAssurance("invisible", riskScore({ signals: { cdp: true }, highVelocity: false }))).toBe(
      "invisible",
    );
  });

  test("automation steps up: one strong signal to liveness, combined weak ones to presence", () => {
    expect(requiredAssurance("invisible", riskScore({ signals: { webdriver: true }, highVelocity: false }))).toBe(
      "liveness",
    );
    expect(requiredAssurance("invisible", riskScore({ signals: { cdp: true }, highVelocity: true }))).toBe("presence");
    expect(
      requiredAssurance("invisible", riskScore({ signals: { headless: true, zeroWindow: true }, highVelocity: false })),
    ).toBe("liveness");
  });

  test("risk only raises the site's policy, never lowers it", () => {
    expect(requiredAssurance("liveness", 0)).toBe("liveness");
    expect(requiredAssurance("presence", 0.9)).toBe("liveness");
  });

  test("only a hash rate no browser reaches counts as offloaded work, not a lucky early nonce", () => {
    expect(riskScore({ signals: { solveMs: 2 }, highVelocity: false, attempts: 2067 })).toBe(0);
    expect(riskScore({ signals: { solveMs: 1000 }, highVelocity: false, attempts: 3_000_000 })).toBe(0);
    expect(riskScore({ signals: { solveMs: 5 }, highVelocity: false, attempts: 400_000 })).toBe(0.3);
  });

  test("the score is capped at 1", () => {
    expect(
      riskScore({
        signals: { webdriver: true, cdp: true, headless: true, zeroWindow: true, solveMs: 1 },
        highVelocity: true,
      }),
    ).toBe(1);
  });
});
