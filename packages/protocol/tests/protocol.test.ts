import { describe, expect, test } from "bun:test";
import { isWidgetMessage, meetsAssurance, widgetUrl } from "../src/index";

describe("isWidgetMessage", () => {
  const frame = {} as Window;
  const event = (origin: string, source: unknown, data: unknown): Pick<MessageEvent, "origin" | "source" | "data"> => ({
    origin,
    source: source as MessageEventSource,
    data,
  });

  test("accepts only our namespaced messages from our frame and origin", () => {
    expect(
      isWidgetMessage(event("https://botrepel.com", frame, { type: "botrepel:ready" }), "https://botrepel.com", frame),
    ).toBe(true);
    expect(
      isWidgetMessage(event("https://evil.com", frame, { type: "botrepel:ready" }), "https://botrepel.com", frame),
    ).toBe(false);
    expect(
      isWidgetMessage(event("https://botrepel.com", {}, { type: "botrepel:ready" }), "https://botrepel.com", frame),
    ).toBe(false);
    expect(
      isWidgetMessage(event("https://botrepel.com", frame, { type: "other" }), "https://botrepel.com", frame),
    ).toBe(false);
    expect(isWidgetMessage(event("https://botrepel.com", frame, "botrepel:ready"), "https://botrepel.com", frame)).toBe(
      false,
    );
  });
});

describe("assurance and URLs", () => {
  test("a stronger assurance meets a weaker requirement, not the reverse", () => {
    expect(meetsAssurance("liveness", "presence")).toBe(true);
    expect(meetsAssurance("invisible", "presence")).toBe(false);
  });

  test("the widget URL carries the options", () => {
    const url = new URL(
      widgetUrl("https://botrepel.com", {
        siteKey: "br_pk_abc",
        hostOrigin: "https://acme.com",
        action: "signup",
        minAssurance: "presence",
      }),
    );
    expect(url.pathname).toBe("/w/br_pk_abc");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      origin: "https://acme.com",
      action: "signup",
      min: "presence",
    });
  });
});
