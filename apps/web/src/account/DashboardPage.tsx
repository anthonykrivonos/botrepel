import { AccountNav } from "./AccountNav";
import { BalanceCard } from "./BalanceCard";
import { SiteDetail } from "./SiteDetail";
import { SitesList } from "./SitesList";
import { useAccount } from "../hooks/useAccount";

export function DashboardPage(): React.JSX.Element {
  const account = useAccount();
  if (!account) {
    return <main id="content" aria-busy="true" className="min-h-dvh" />;
  }
  const siteId = new URLSearchParams(window.location.search).get("site");
  return (
    <>
      <AccountNav email={account.email} />
      <main id="content" className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-12 sm:px-6">
        {siteId ? (
          <SiteDetail siteId={siteId} />
        ) : (
          <>
            <BalanceCard />
            <SitesList />
          </>
        )}
      </main>
    </>
  );
}
