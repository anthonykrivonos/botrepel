import { describe, expect, test } from "bun:test";
import { networkOf } from "../../lib/db";

describe("networkOf", () => {
  test("keeps IPv4 addresses whole", () => {
    expect(networkOf("203.0.113.7")).toBe("203.0.113.7");
  });

  test("limits IPv6 by its /64, however it's written", () => {
    const network = "2001:db8:abcd:12::/64";
    expect(networkOf("2001:db8:abcd:12::1")).toBe(network);
    expect(networkOf("2001:0db8:abcd:0012:ffff:1:2:3")).toBe(network);
    expect(networkOf("2001:DB8:ABCD:12:0:0:0:9")).toBe(network);
    expect(networkOf("2001:db8:abcd:13::1")).not.toBe(network);
    expect(networkOf("::1")).toBe("0:0:0:0::/64");
  });
});
