import { expect, test } from "@playwright/test";
import { E2E_ORIGIN, hostPage, seedPass, seedSite } from "./host";

test.use({ channel: "chromium", launchOptions: { args: ["--disable-blink-features=AutomationControlled"] } });

test("a returning person confirms with one tap of their Human Pass", async ({ page, request }) => {
  const site = seedSite("localhost", { "*": "presence" });
  const pass = seedPass();
  // The person's device: a platform authenticator that already holds their Human Pass.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });
  await cdp.send("WebAuthn.addCredential", {
    authenticatorId,
    credential: {
      credentialId: pass.credentialId,
      isResidentCredential: true,
      rpId: new URL(E2E_ORIGIN).hostname,
      privateKey: pass.privateKey,
      userHandle: pass.userHandle,
      signCount: 0,
    },
  });

  const { origin, server } = await hostPage(site);
  try {
    await page.goto(origin);
    const widget = page.frameLocator("#botrepel");
    await expect(widget.getByRole("heading", { name: "Confirm you're human" })).toBeVisible();
    await widget.getByRole("button", { name: "Use Human Pass" }).click();
    await expect(widget.getByRole("status")).toContainText("You're verified");

    const token = await page.evaluate(
      () =>
        (window as unknown as { botrepelMessages: { type: string; token?: string }[] }).botrepelMessages.find(
          (message) => message.type === "botrepel:token",
        )?.token,
    );
    const verified = (await (
      await request.post(`${E2E_ORIGIN}/v1/siteverify`, { form: { secret: site.secretKey, response: token! } })
    ).json()) as { success: boolean; assurance: string; pseudonym: string };
    expect(verified).toMatchObject({ success: true, assurance: "presence" });
    expect(verified.pseudonym).toBeTruthy();
  } finally {
    server.close();
  }
});
