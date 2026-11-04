import { glassClassName } from "../components/Glass";
import { useReveal } from "../hooks/useReveal";

interface Evidence {
  readonly figure: string;
  readonly claim: string;
  readonly source: string;
  readonly href: string;
  readonly logo: {
    readonly src: string;
    readonly name: string;
    readonly width: number;
    readonly height: number;
    readonly className: string;
  };
}

/** Each figure links to its original source and is also cited in the whitepaper. */
const EVIDENCE: readonly Evidence[] = [
  {
    figure: "0 of 3",
    claim: "LLM browser agents stopped by Turnstile",
    source: "Vendor-run benchmark, 2026",
    href: "https://research.poh.org/bot-benchmarking-2026/",
    logo: {
      // The white mark embedded in the research site's header.
      src: "/logos/proof-of-human.svg",
      name: "Proof of Human",
      width: 4293,
      height: 1155,
      className: "h-9 w-auto",
    },
  },
  {
    figure: "100%",
    claim: "of reCAPTCHA v2 image challenges solved",
    source: "ETH Zürich, 2024",
    href: "https://arxiv.org/abs/2409.08831",
    logo: {
      // The official wordmark embedded at https://ethz.ch/en.html.
      src: "/logos/eth-zurich.svg",
      name: "ETH Zürich",
      width: 120,
      height: 20,
      className: "h-6 w-auto invert",
    },
  },
  {
    figure: "60.7%",
    claim: "solved across 26 CAPTCHA types",
    source: "USENIX Security, 2025",
    href: "https://www.usenix.org/conference/usenixsecurity25/presentation/teoh",
    logo: {
      // https://www.usenix.org/themes/motherboard/logo.png
      src: "/logos/usenix.png",
      name: "USENIX",
      width: 432,
      height: 114,
      className: "h-8 w-auto grayscale invert",
    },
  },
  {
    figure: "$0.80+",
    claim: "per identity check, about 800× a CAPTCHA",
    source: "Published pricing, 2026",
    href: "https://www.veriff.com/pricing",
    logo: {
      // https://www.veriff.com/wp-content/uploads/2025/03/logo_veriff.svg
      src: "/logos/veriff.svg",
      name: "Veriff",
      width: 123,
      height: 36,
      className: "h-8 w-auto brightness-0 invert",
    },
  },
];

/** Research and vendor evidence, with the source of each figure shown on its own card. */
export function EvidenceBar(): React.JSX.Element {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} aria-labelledby="evidence-title" className="border-y border-line bg-well/60">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 id="evidence-title" className="mb-10 text-center text-sm font-normal text-fg-subtle">
          Cited results on automated CAPTCHA solving, from{" "}
          <a
            href="/research/botrepel-whitepaper.pdf"
            className="text-fg-muted underline underline-offset-4 hover:text-fg"
          >
            our whitepaper
          </a>
          .
        </h2>
        <ul data-stagger className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {EVIDENCE.map((item) => (
            <li key={item.claim} className={glassClassName("flex min-w-0 flex-col gap-3 p-4 sm:p-6")}>
              <span className="font-display text-4xl leading-none tracking-[-0.02em] text-fg sm:text-6xl">
                {item.figure}
              </span>
              <span className="text-sm text-fg-muted">{item.claim}</span>
              <a
                href={item.href}
                className="group mt-auto flex flex-col gap-4 pt-6"
                aria-label={`${item.logo.name}: ${item.source}`}
              >
                <span className="font-mono text-[11px] leading-relaxed tracking-wide text-fg-subtle uppercase transition-colors duration-150 group-hover:text-fg">
                  {item.source}
                </span>
                <span className="flex h-10 items-center">
                  <img
                    src={item.logo.src}
                    alt=""
                    width={item.logo.width}
                    height={item.logo.height}
                    loading="lazy"
                    className={`max-w-full object-contain object-left opacity-75 transition-opacity duration-150 group-hover:opacity-100 ${item.logo.className}`}
                  />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
