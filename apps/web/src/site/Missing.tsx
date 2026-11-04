import { buttonClassName } from "../components/Button";
import { Nav } from "../components/Nav";

export function Missing(): React.JSX.Element {
  return (
    <>
      <Nav />
      <main
        id="content"
        className="mx-auto flex min-h-[70dvh] max-w-xl flex-col items-center justify-center gap-6 px-4 text-center"
      >
        <p className="font-mono text-sm text-fg-subtle">404</p>
        <h1 className="font-display text-display-sm font-normal">Page not found</h1>
        <p className="text-fg-muted">This address does not match a page.</p>
        <a href="/" className={buttonClassName("secondary")}>
          Go Home
        </a>
      </main>
    </>
  );
}
