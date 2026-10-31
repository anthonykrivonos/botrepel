import { renderToString } from "react-dom/server";
import type { SitePage } from "./content";
import { escapeHtml, renderHead, type SeoConfig } from "./seo";
import { App } from "../App";
import { RpcProvider } from "../components/RpcProvider";

export function renderDocument(shell: string, page: SitePage, config: SeoConfig): string {
  if (!shell.includes('<div id="root"></div>') || !shell.includes("<title>")) {
    throw new Error("The HTML build must contain its <title> and an empty #root.");
  }
  return shell
    .replace(/<meta\s+name="robots"[^>]*>/, "")
    .replace(/<title>[\s\S]*?<\/title>/, () => renderHead(page, config))
    .replace(
      '<div id="root"></div>',
      () =>
        `<div id="root" data-page-path="${escapeHtml(page.path)}">${renderToString(
          <RpcProvider>
            <App path={page.path} />
          </RpcProvider>,
        )}</div>`,
    );
}
