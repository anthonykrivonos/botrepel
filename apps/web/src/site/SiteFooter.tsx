import { HUBS } from "./guides/hubs";
import { Glass } from "../components/Glass";
import { Logo } from "../components/Logo";
import { CONTACT_EMAIL } from "../shared/constants";

interface FooterLink {
  readonly href: string;
  readonly label: string;
}

const COLUMNS: readonly { readonly title: string; readonly links: readonly FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/#faq", label: "FAQ" },
      { href: "/about", label: "About" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "/docs", label: "Docs" },
      { href: "/install.md", label: "Install guide" },
      { href: "/#integrate", label: "Code samples" },
      { href: "/llms.txt", label: "llms.txt" },
    ],
  },
  {
    title: "Research",
    links: [
      { href: "/research/botrepel-whitepaper.pdf", label: "Whitepaper" },
      { href: "/research/botrepel-whitepaper.tex", label: "LaTeX source" },
      { href: "/#privacy", label: "Privacy architecture" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: `mailto:${CONTACT_EMAIL}`, label: "Contact" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of service" },
      { href: "/dpa", label: "Data processing addendum" },
    ],
  },
];

export function SiteFooter(): React.JSX.Element {
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6">
      <Glass className="overflow-hidden rounded-dialog p-0">
        <div className="grid gap-12 p-6 sm:p-8 lg:grid-cols-[1.2fr_2fr] lg:p-10">
          <div className="flex flex-col gap-4">
            <a href="/" aria-label="BotRepel home" className="self-start">
              <Logo className="text-lg" />
            </a>
            <p className="max-w-xs text-sm text-fg-subtle">
              Human verification for websites. Light-check frames are analyzed in memory and then discarded.
            </p>
            <h2 className="text-sm font-medium text-fg">Guides</h2>
            <ul className="flex flex-col gap-2">
              <li>
                <a href="/guides" className="text-sm text-fg-subtle transition-colors duration-150 hover:text-fg">
                  All guides
                </a>
              </li>
              {HUBS.map((hub) => (
                <li key={hub.path}>
                  <a href={hub.path} className="text-sm text-fg-subtle transition-colors duration-150 hover:text-fg">
                    {hub.heading}
                  </a>
                </li>
              ))}
              <li>
                <a href="/articles" className="text-sm text-fg-subtle transition-colors duration-150 hover:text-fg">
                  All articles
                </a>
              </li>
            </ul>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {COLUMNS.map((column) => (
              <div key={column.title} className="flex flex-col gap-3">
                <h2 className="text-sm font-medium text-fg">{column.title}</h2>
                <ul className="flex flex-col gap-2">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        className="text-sm text-fg-subtle transition-colors duration-150 hover:text-fg"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="border-t border-line">
          <p className="px-6 py-5 text-xs text-fg-subtle sm:px-8 lg:px-10">
            © {new Date().getFullYear()} BotRepel. Human verification for websites.
          </p>
        </div>
      </Glass>
    </footer>
  );
}
