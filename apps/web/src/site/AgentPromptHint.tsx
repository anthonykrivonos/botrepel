import { Fragment } from "react";

const AGENTS = [
  { name: "Claude Code", icon: "/logos/agents/anthropic.png" },
  { name: "Cursor", icon: "/logos/agents/cursor.svg" },
  { name: "Codex", icon: "/logos/agents/openai.png" },
] as const;

export function AgentPromptHint(): React.JSX.Element {
  return (
    <p className="text-sm text-fg-subtle">
      Or paste this into
      {AGENTS.map((agent, index) => (
        <Fragment key={agent.name}>
          {index === 0 ? " " : index === AGENTS.length - 1 ? ", or " : ", "}
          <span className="inline-flex items-center gap-1 align-middle whitespace-nowrap">
            <img src={agent.icon} alt="" width={16} height={16} className="size-4 shrink-0 object-contain" />
            {agent.name}
          </span>
        </Fragment>
      ))}
    </p>
  );
}
