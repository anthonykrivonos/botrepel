import { describe, expect, test } from "bun:test";
import { previewOrigins, productionEnvProblems, readEnv } from "../../lib/env";

const secret = "x".repeat(32);
const complete = {
  SITE_URL: "https://botrepel.com",
  DATABASE_URL: "postgres://user:pass@db.example.com/botrepel",
  BETTER_AUTH_SECRET: secret,
  CHALLENGE_SECRET: secret,
  PASS_PSEUDONYM_KEY: secret,
  CRON_SECRET: secret,
  GITHUB_CLIENT_ID: "id",
  GITHUB_CLIENT_SECRET: "secret",
  VERCEL: "1",
};

describe("a production build", () => {
  test("passes with every required setting", () => {
    expect(productionEnvProblems(readEnv(complete))).toEqual([]);
  });

  test("names each missing or weak setting", () => {
    const problems = productionEnvProblems(
      readEnv({ ...complete, CHALLENGE_SECRET: "short", DATABASE_URL: undefined, STRIPE_SECRET_KEY: "sk_live_x" }),
    );
    expect(problems.join(" ")).toContain("CHALLENGE_SECRET");
    expect(problems.join(" ")).toContain("DATABASE_URL");
    expect(problems.join(" ")).toContain("STRIPE_WEBHOOK_SECRET");
    expect(problems).toHaveLength(3);
  });

  test("needs a way to sign in", () => {
    const problems = productionEnvProblems(
      readEnv({ ...complete, GITHUB_CLIENT_ID: undefined, GITHUB_CLIENT_SECRET: undefined }),
    );
    expect(problems).toEqual(["Configure a sign-in method: GitHub, Google, or RESEND_API_KEY with EMAIL_FROM."]);
  });
});

describe("previewOrigins", () => {
  test("a preview trusts its branch alias and deployment URL; production trusts neither", () => {
    const hosts = {
      VERCEL: "1",
      VERCEL_URL: "botrepel-abc.vercel.app",
      VERCEL_BRANCH_URL: "botrepel-git-x.vercel.app",
    };
    expect(previewOrigins(readEnv({ ...hosts, VERCEL_ENV: "preview" }))).toEqual([
      "https://botrepel-git-x.vercel.app",
      "https://botrepel-abc.vercel.app",
    ]);
    expect(previewOrigins(readEnv({ ...hosts, VERCEL_ENV: "production" }))).toEqual([]);
  });
});
