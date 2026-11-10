import { articleByPath } from "./articles";
import type { SitePage } from "./content";
import { FAQ } from "./faq-data";
import { OPERATOR, OPERATOR_POSTAL } from "./legal";
import { SITE_NAME, CONTACT_EMAIL } from "../shared/constants";
import { MICROS_PER_DOLLAR, PRICE_MICROS } from "../shared/pricing";
import { absolute } from "../shared/utils";

export interface JsonLdNode {
  readonly "@type": string;
  readonly [key: string]: unknown;
}

export interface JsonLdDocument {
  readonly "@context": "https://schema.org";
  readonly "@graph": readonly JsonLdNode[];
}

const usd = (micros: number): string => (micros / MICROS_PER_DOLLAR).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");

function crumbs(origin: string, page: SitePage): JsonLdNode {
  const home = absolute(origin, "/");
  const items: { name: string; item: string }[] = [{ name: SITE_NAME, item: home }];
  if (page.path.startsWith("/articles/")) {
    items.push({ name: "Articles", item: absolute(origin, "/articles") });
  }
  if (page.path !== "/") {
    items.push({ name: page.heading, item: absolute(origin, page.path) });
  }
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: entry.item,
    })),
  };
}

/** Organization, WebSite, SoftwareApplication, BreadcrumbList, plus FAQPage or TechArticle when the page has them. */
export function structuredData(page: SitePage, origin: string): JsonLdDocument {
  const siteUrl = absolute(origin, "/");
  const organizationId = absolute(origin, "/#organization");
  const graph: JsonLdNode[] = [
    {
      "@type": "Organization",
      "@id": organizationId,
      name: SITE_NAME,
      legalName: OPERATOR,
      url: siteUrl,
      email: CONTACT_EMAIL,
      logo: absolute(origin, "/favicon.svg"),
      address: { "@type": "PostalAddress", ...OPERATOR_POSTAL },
    },
    {
      "@type": "WebSite",
      "@id": absolute(origin, "/#website"),
      name: SITE_NAME,
      url: siteUrl,
      publisher: { "@id": organizationId },
    },
    {
      "@type": "SoftwareApplication",
      "@id": absolute(origin, "/#software"),
      name: SITE_NAME,
      applicationCategory: "SecurityApplication",
      operatingSystem: "Web",
      url: siteUrl,
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        lowPrice: usd(PRICE_MICROS.invisible),
        highPrice: usd(PRICE_MICROS.liveness),
        offerCount: 3,
        description: "Price per successful siteverify. The amount depends on the check the token proved.",
      },
    },
    crumbs(origin, page),
  ];
  if (page.kind === "home") {
    graph.push({
      "@type": "FAQPage",
      mainEntity: FAQ.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    });
  }
  const article = page.kind === "article" ? articleByPath(page.path) : undefined;
  if (article) {
    graph.push({
      "@type": "TechArticle",
      headline: article.heading,
      description: article.description,
      datePublished: article.updated,
      dateModified: article.updated,
      mainEntityOfPage: absolute(origin, article.path),
      author: { "@type": "Organization", name: SITE_NAME, url: siteUrl },
      publisher: { "@id": organizationId },
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

export function renderJsonLd(page: SitePage, origin: string): string {
  const json = JSON.stringify(structuredData(page, origin)).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function need(node: Record<string, unknown>, key: string, typeName: string, errors: string[]): void {
  const value = node[key];
  if (typeof value === "string" ? value.length === 0 : value === undefined || value === null) {
    errors.push(`${typeName} is missing ${key}.`);
  }
}

function checkNode(node: Record<string, unknown>, errors: string[]): void {
  const typeName = node["@type"];
  if (typeof typeName !== "string") {
    errors.push("A JSON-LD node is missing @type.");
    return;
  }
  if (typeName === "Organization") {
    need(node, "name", typeName, errors);
    need(node, "legalName", typeName, errors);
    need(node, "url", typeName, errors);
  } else if (typeName === "WebSite") {
    need(node, "name", typeName, errors);
    need(node, "url", typeName, errors);
    if (!isRecord(node.publisher)) {
      errors.push("WebSite is missing publisher.");
    }
  } else if (typeName === "SoftwareApplication") {
    need(node, "name", typeName, errors);
    need(node, "applicationCategory", typeName, errors);
    if (!isRecord(node.offers)) {
      errors.push("SoftwareApplication is missing offers.");
    } else {
      need(node.offers, "priceCurrency", "AggregateOffer", errors);
      need(node.offers, "lowPrice", "AggregateOffer", errors);
      need(node.offers, "highPrice", "AggregateOffer", errors);
    }
  } else if (typeName === "FAQPage") {
    if (!Array.isArray(node.mainEntity) || node.mainEntity.length === 0) {
      errors.push("FAQPage is missing mainEntity.");
    } else {
      for (const question of node.mainEntity) {
        if (!isRecord(question) || question["@type"] !== "Question") {
          errors.push("FAQPage mainEntity entries must be Questions.");
          continue;
        }
        need(question, "name", "Question", errors);
        const answer = question.acceptedAnswer;
        if (!isRecord(answer) || typeof answer.text !== "string" || answer.text.length === 0) {
          errors.push("Question is missing acceptedAnswer.text.");
        }
      }
    }
  } else if (typeName === "BreadcrumbList") {
    if (!Array.isArray(node.itemListElement) || node.itemListElement.length === 0) {
      errors.push("BreadcrumbList is missing itemListElement.");
    } else {
      for (const item of node.itemListElement) {
        if (!isRecord(item)) {
          errors.push("BreadcrumbList items must be objects.");
          continue;
        }
        need(item, "position", "ListItem", errors);
        need(item, "name", "ListItem", errors);
        need(item, "item", "ListItem", errors);
      }
    }
  } else if (typeName === "TechArticle") {
    need(node, "headline", typeName, errors);
    need(node, "dateModified", typeName, errors);
    need(node, "mainEntityOfPage", typeName, errors);
    if (!isRecord(node.author)) {
      errors.push("TechArticle is missing author.");
    }
  } else {
    errors.push(`Unexpected @type ${typeName}.`);
  }
}

/** Returns schema.org shape errors. An empty list means the document matches the types this site emits. */
export function validateStructuredData(
  value: unknown,
  expected: { readonly faq: boolean; readonly article: boolean },
): readonly string[] {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return ["JSON-LD root must be an object."];
  }
  if (value["@context"] !== "https://schema.org") {
    errors.push("@context must be https://schema.org.");
  }
  if (!Array.isArray(value["@graph"])) {
    return [...errors, "@graph must be an array."];
  }
  const types = new Set<string>();
  for (const node of value["@graph"]) {
    if (!isRecord(node)) {
      errors.push("Each @graph entry must be an object.");
      continue;
    }
    if (typeof node["@type"] === "string") {
      types.add(node["@type"]);
    }
    checkNode(node, errors);
  }
  for (const typeName of ["Organization", "WebSite", "SoftwareApplication", "BreadcrumbList"]) {
    if (!types.has(typeName)) {
      errors.push(`Missing ${typeName}.`);
    }
  }
  if (expected.faq !== types.has("FAQPage")) {
    errors.push(expected.faq ? "Missing FAQPage." : "FAQPage is only for the home page.");
  }
  if (expected.article !== types.has("TechArticle")) {
    errors.push(expected.article ? "Missing TechArticle." : "TechArticle is only for an article.");
  }
  return errors;
}
