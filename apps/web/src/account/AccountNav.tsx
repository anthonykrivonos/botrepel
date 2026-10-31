import { signOut } from "./client";
import { Button } from "../components/Button";
import { Logo } from "../components/Logo";

interface AccountNavProps {
  readonly email: string;
}

export function AccountNav({ email }: AccountNavProps): React.JSX.Element {
  return (
    <header className="border-b border-line">
      <nav aria-label="Account" className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:px-6">
        <a href="/dashboard" aria-label="Dashboard">
          <Logo />
        </a>
        <span className="ml-auto hidden truncate text-sm text-fg-subtle sm:block">{email}</span>
        <a href="/settings" className="text-sm text-fg-muted hover:text-fg">
          Settings
        </a>
        <Button variant="ghost" size="sm" className="ml-auto sm:ml-0" onClick={() => void signOut()}>
          Sign Out
        </Button>
      </nav>
    </header>
  );
}
