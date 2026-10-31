import type { Project } from "./detect";
import { guideFor, guideText, type Guide, type GuideContext } from "./guides";

export function guideContext(project: Project, apiOrigin: string, defaultOrigin: string): GuideContext {
  const siteKeyVar = `${project.publicPrefix}BOTREPEL_SITE_KEY`;
  return {
    siteKey:
      project.framework === "next"
        ? `process.env.${siteKeyVar}!`
        : project.framework === "unknown"
          ? `"<your site key from ${project.envFile}>"`
          : `import.meta.env.${siteKeyVar}`,
    apiOrigin: apiOrigin === defaultOrigin ? undefined : apiOrigin,
  };
}

/** The guides for this project: one per detected auth library, then any other form. */
export function projectGuides(project: Project, context: GuideContext): Guide[] {
  return [...project.auth.map((library) => guideFor(library, context)), guideFor("forms", context)];
}

/** What the developer or their coding agent does next, with this project's variable names. */
export function nextSteps(project: Project, apiOrigin: string, defaultOrigin: string): string {
  const guides = projectGuides(project, guideContext(project, apiOrigin, defaultOrigin));
  const sections = guides.map((guide) =>
    guide.id === "forms" && guides.length > 1
      ? `Other forms (contact, comments, checkout):\n\n${guideText(guide)}`
      : `${guide.title}:\n\n${guideText(guide)}`,
  );
  return `Next steps:

${sections.join("\n\n")}

Never send BOTREPEL_SECRET_KEY to the browser. Once the pieces are connected, submit a protected form locally.
Tune checks per action at ${apiOrigin}/dashboard.`;
}
