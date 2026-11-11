import type { ReactNode } from "react";
import type { ArticleBlock } from "./article-types";
import { CodeBlock } from "../components/CodeBlock";

const TOKEN = /(`[^`]+`|\[[^\]]+\]\((?:\/|https:\/\/|mailto:)[^)\s]+\))/g;

function Inline({ text }: { readonly text: string }): ReactNode {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) {
      nodes.push(text.slice(last, index));
    }
    const part = match[0];
    if (part.startsWith("`")) {
      nodes.push(
        <code key={index} className="rounded bg-surface-raised px-1 py-0.5">
          {part.slice(1, -1)}
        </code>,
      );
    } else {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
      if (link) {
        nodes.push(
          <a key={index} href={link[2]} className="underline underline-offset-4 hover:text-fg">
            {link[1]}
          </a>,
        );
      }
    }
    last = index + part.length;
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return nodes;
}

export function ArticleBlocks({ blocks }: { readonly blocks: readonly ArticleBlock[] }): React.JSX.Element {
  return (
    <>
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;
        if (block.kind === "p") {
          return (
            <p key={key} className="text-fg-body">
              <Inline text={block.text} />
            </p>
          );
        }
        if (block.kind === "ul" || block.kind === "ol") {
          const Tag = block.kind === "ul" ? "ul" : "ol";
          return (
            <Tag
              key={key}
              className={
                block.kind === "ul"
                  ? "list-disc space-y-2 pl-5 text-fg-body"
                  : "list-decimal space-y-2 pl-5 text-fg-body"
              }
            >
              {block.items.map((item) => (
                <li key={item}>
                  <Inline text={item} />
                </li>
              ))}
            </Tag>
          );
        }
        if (block.kind === "code") {
          return <CodeBlock key={key} title={block.title} code={block.code} />;
        }
        const { figure } = block;
        return (
          <figure key={key} className="flex flex-col gap-3">
            <img
              src={figure.src}
              alt={figure.alt}
              width={figure.width}
              height={figure.height}
              loading="lazy"
              decoding="async"
              className="h-auto w-full rounded-card border border-line bg-surface"
            />
            <figcaption className="text-sm text-fg-subtle">{figure.caption}</figcaption>
          </figure>
        );
      })}
    </>
  );
}
