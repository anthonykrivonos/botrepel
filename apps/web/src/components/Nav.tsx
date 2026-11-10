import { useState } from "react";
import { buttonClassName } from "./Button";
import { Logo } from "./Logo";

interface NavLink {
  readonly href: string;
  readonly label: string;
}

const LINKS: readonly NavLink[] = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#integrate", label: "Developers" },
  { href: "/#research", label: "Research" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
  { href: "/articles", label: "Articles" },
  { href: "/about", label: "About" },
];

export function Nav(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-10 border-b border-line glass">
      <a
        href="#content"
        className="absolute top-3 left-4 z-20 -translate-y-24 rounded-control bg-fg px-3 py-2 text-sm font-medium text-canvas focus:translate-y-0"
      >
        Skip to content
      </a>
      <nav aria-label="Main" className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <a href="/" aria-label="BotRepel home">
          <Logo />
        </a>
        <ul className="hidden flex-1 gap-1 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className={buttonClassName("ghost", "sm")}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <button
            type="button"
            className={buttonClassName("ghost", "sm", "md:hidden")}
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((current) => !current)}
          >
            {open ? "Close" : "Menu"}
          </button>
          <a href="/login" className={buttonClassName("ghost", "sm", "max-md:hidden")}>
            Sign In
          </a>
          <a
            href="/login"
            className={buttonClassName(
              "primary",
              "sm",
              "bg-linear-to-br from-sky-200 via-blue-200 to-violet-300 text-canvas transition-[filter] hover:brightness-110",
            )}
          >
            Get Started
          </a>
        </div>
      </nav>
      {open ? (
        <ul id="site-menu" className="mx-auto flex max-w-6xl flex-col px-2 py-2 md:hidden">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className={buttonClassName("ghost", "sm", "w-full justify-start")}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </header>
  );
}
