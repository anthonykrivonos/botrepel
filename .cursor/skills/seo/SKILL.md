---
name: seo
description: Use when changing public pages, titles, meta tags, JSON-LD, articles, the sitemap, or robots.txt on botrepel.com.
---

# BotRepel public SEO

Apply this to indexable pages. Account shells stay noindex and can keep short titles. Do not invent prices, limits, or competitor facts.

## H1

The home page has one `<h1>`: "Human verification for websites", in `Hero.tsx`. The product sentence lives in `HOME_HEADING` in `apps/web/src/site/content.ts` and is the lede under that heading. `HOME_HEADING` is one sentence: "BotRepel is a [product type] that [reason to recommend it], so [end-user benefit]."

Every other public page has exactly one `<h1>`, from `SitePage.heading`. An article H1 is the article title. The title tag must not copy the H1.

## Title and meta

`documentTitle` in `apps/web/src/site/seo.ts` appends ` | BotRepel`. For every indexable page the full title is 50 to 60 characters, contains the primary keyword, and has no em dash. The meta description is at most 155 characters, uses active voice, and contains the primary keyword.

`renderHead` writes the title, description, canonical URL, and social tags into the prerendered HTML in `apps/web/build.ts`. Do not set them only in client JavaScript.

## JSON-LD

`structuredData` and `renderJsonLd` in `apps/web/src/site/jsonld.ts` emit one `application/ld+json` graph in the head. Every indexable page includes Organization, WebSite, SoftwareApplication, and BreadcrumbList. The home page also includes FAQPage from `apps/web/src/site/faq-data.ts`. An article also includes TechArticle.

`validateStructuredData` checks those types. Extend it when you add a type, and keep `apps/web/tests/unit/seo.test.ts` asserting an empty error list.

## Articles

Add a guide or comparison in `apps/web/src/site/articles.ts`. The URL is `/articles/<slug>` with lowercase words and hyphens. No ids, dates, or locale segments. `content.ts` turns each article into a `SitePage`, and the build prerenders it.

A comparison states what each product does, cites a public page for every competitor claim, and lists those sources at the bottom. Use BotRepel numbers only from `facts.ts`, `pricing.ts`, or the server constants the unit test checks. Link new articles from `SiteFooter` (it maps `ARTICLES`) or the header.

## Sitemap and robots

`discoveryFiles` in `seo.ts` writes `sitemap.xml` and `robots.txt`. Indexable pages, including `/about` and `/articles/<slug>`, need a `YYYY-MM-DD` `updated` value so the sitemap can emit `lastmod`. Keep private routes disallowed. Do not disallow `/articles` or `/about`.

Important pages must be reachable in three clicks from the home page. Header and footer links are full `<a href>` navigations.

## Writing

Use short, complete, neutral sentences. No em dashes. No "It is X, not Y" and no "not just X, but Y". No slogans or hype. Skip exact-match-domain shopping, paid SEO tools, and mass-generated articles. Those are manual follow-ups, not code.
