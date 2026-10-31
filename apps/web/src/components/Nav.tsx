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
];

export function Nav(): React.JSX.Element {
  return (
    <header className="sticky top-0 z-10 border-b border-line glass">
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
          <a href="/login" className={buttonClassName("ghost", "sm")}>
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
    </header>
  );
}
