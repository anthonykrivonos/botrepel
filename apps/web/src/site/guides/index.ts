import type { Article } from "../article-types";
import { ACCOUNT_ARTICLES } from "./accounts";
import { BLOCKING_ARTICLES } from "./blocking";
import { NODE_FRAMEWORK_ARTICLES } from "./frameworks-node";
import { OTHER_FRAMEWORK_ARTICLES } from "./frameworks-other";
import { HUBS, hubByPath, hubBySlug } from "./hubs";
import { REFERENCE_ARTICLES } from "./reference";

export { HUBS, hubByPath, hubBySlug };
export type { Hub } from "./hubs";

export const GUIDE_ARTICLES: readonly Article[] = [
  ...BLOCKING_ARTICLES,
  ...ACCOUNT_ARTICLES,
  ...NODE_FRAMEWORK_ARTICLES,
  ...OTHER_FRAMEWORK_ARTICLES,
  ...REFERENCE_ARTICLES,
];
