import type { Signals } from "../shared/signals";

/** True when a DevTools-protocol client (Puppeteer, Playwright, a debugger) serializes console arguments. */
function cdpAttached(): boolean {
  let touched = false;
  const probe = new Error("");
  Object.defineProperty(probe, "stack", {
    get() {
      touched = true;
      return "";
    },
  });

  console.debug(probe);
  return touched;
}

/** Evidence of automation only; a real browser reports nothing. */
export function collectSignals(solveMs: number): Signals {
  const agent = navigator.userAgent;
  const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands;
  return {
    webdriver: navigator.webdriver === true,
    cdp: cdpAttached(),
    headless: /HeadlessChrome/.test(agent) || Boolean(brands?.some((brand) => /Headless/i.test(brand.brand))),
    zeroWindow: window.outerWidth === 0 && window.outerHeight === 0,
    solveMs: Math.round(solveMs),
  };
}
