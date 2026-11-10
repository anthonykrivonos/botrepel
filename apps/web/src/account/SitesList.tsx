import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { NewSiteDialog } from "./NewSiteDialog";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { rpc } from "../utils/rpc";

export function SitesList(): React.JSX.Element {
  const sites = useQuery(rpc.sites.list.queryOptions());
  const [creating, setCreating] = useState(false);
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg">Sites</h1>
        <Button size="sm" onClick={() => setCreating(true)}>
          New Site
        </Button>
      </div>
      {sites.data?.length === 0 && (
        <Card>
          <p className="text-fg-muted">
            There are no sites yet. Create one here, or run <code className="text-fg">npx botrepel init</code> in your
            app.
          </p>
        </Card>
      )}
      {sites.data && sites.data.length > 0 && (
        <ul className="overflow-hidden rounded-card border border-line">
          {sites.data.map((site) => (
            <li key={site.id} className="border-b border-line last:border-b-0">
              <a
                href={`/dashboard?site=${site.id}`}
                className="flex items-center gap-4 px-4 py-3 transition-colors duration-150 hover:bg-surface"
              >
                <span className="flex-1 truncate text-fg">{site.name}</span>
                <span className="hidden truncate text-sm text-fg-subtle sm:block">{site.domains.join(", ")}</span>
                <code className="text-xs text-fg-subtle">{site.siteKey}</code>
              </a>
            </li>
          ))}
        </ul>
      )}
      <NewSiteDialog open={creating} onClose={() => setCreating(false)} />
    </section>
  );
}
