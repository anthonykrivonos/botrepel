import { useQuery } from "@tanstack/react-query";
import { SiteInstall } from "./SiteInstall";
import { SiteKeys } from "./SiteKeys";
import { SitePolicies } from "./SitePolicies";
import { Card } from "../components/Card";
import { rpc } from "../utils/rpc";

interface SiteDetailProps {
  readonly siteId: string;
}

export function SiteDetail({ siteId }: SiteDetailProps): React.JSX.Element {
  const sites = useQuery(rpc.sites.list.queryOptions());
  const site = sites.data?.find((candidate) => candidate.id === siteId);
  if (sites.isSuccess && !site) {
    return (
      <Card>
        <p className="text-fg-muted">That site doesn't exist.</p>
      </Card>
    );
  }
  if (!site) {
    return <div aria-busy="true" />;
  }
  return (
    <div className="flex flex-col gap-8">
      <div>
        <a href="/dashboard" className="text-sm text-fg-subtle hover:text-fg">
          ← Sites
        </a>
        <h1 className="mt-2 font-display text-[2.5rem] leading-tight font-normal">{site.name}</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <SiteKeys site={site} />
        <SitePolicies key={site.id} site={site} />
      </div>
      <SiteInstall siteKey={site.siteKey} />
    </div>
  );
}
