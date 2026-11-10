import { CONTACT_EMAIL, SITE_NAME } from "../shared/constants";
import { FREE_CREDIT_MICROS, formatDollars } from "../shared/pricing";

/** The legal operator of the service. */
export const OPERATOR = "Paraworks LLC";
export const OPERATOR_POSTAL = {
  streetAddress: "87-20 63rd Ave",
  addressLocality: "Rego Park",
  addressRegion: "NY",
  postalCode: "11374",
  addressCountry: "US",
} as const;
export const OPERATOR_ADDRESS = `${OPERATOR_POSTAL.streetAddress}, ${OPERATOR_POSTAL.addressLocality}, ${OPERATOR_POSTAL.addressRegion} ${OPERATOR_POSTAL.postalCode}`;

export interface LegalSection {
  readonly heading: string;
  readonly paragraphs: readonly string[];
}

export interface LegalDocument {
  readonly title: string;
  readonly updated: string;
  readonly intro: string;
  readonly sections: readonly LegalSection[];
}

/** Describes what the code actually does; keep it in step with lib/schema.ts and the widget. */
export const PRIVACY: LegalDocument = {
  title: "Privacy policy",
  updated: "October 27, 2026",
  intro: `${SITE_NAME} is operated by ${OPERATOR} ("we"). It checks that a real person is present on websites that use it. This policy explains what we process to do that, for two groups: visitors who complete a check on a website ("visitors"), and the businesses and developers who add ${SITE_NAME} to their websites ("customers").`,
  sections: [
    {
      heading: "Visitors: the invisible check",
      paragraphs: [
        'When a page with our widget loads, your browser solves a small proof-of-work puzzle and reports a few signals about itself, such as whether it is being driven by automation software. We also receive the website\'s hostname and the action being protected (for example, "signup").',
        "We keep a keyed hash of your IP address for a short time to limit how often checks can be requested. We don't use these signals to identify you or to follow you across websites.",
      ],
    },
    {
      heading: "Visitors: the light check",
      paragraphs: [
        "Some websites ask for a light check. Before your camera turns on, the widget explains what will happen and asks you to continue. Your screen then shows a two-second color sequence while the camera records how the light reflects off your face.",
        "The widget uploads small, low-resolution crops of your face from those frames. We analyze them in memory during that request and then discard them. We never store images or video, never create a face template, and never compare your face with anyone else's.",
        "We keep a few numeric measurements from each check (for example, how closely the reflected light followed the sequence, and the image brightness) so we can improve accuracy. These are recorded by day, aren't linked to you or to a website, and can't be used to recognize anyone.",
      ],
    },
    {
      heading: "Visitors: Human Pass",
      paragraphs: [
        "After a light check, you can save a Human Pass: a passkey kept on your device or in your password manager. Your fingerprint, face, or device PIN unlocks it on your device; we never receive them.",
        "We store the passkey's public key, its credential ID, a counter, and basic authenticator details. We don't ask for your name or email. Each website gets a different pseudonym derived from your pass, so websites can't link you to each other.",
        "Inside our systems, we record which pass was used for each check so we can act on abuse reports: if several established websites report a pass for abuse, we may disable it. We never share this link with websites.",
      ],
    },
    {
      heading: "Customers",
      paragraphs: [
        "When you create an account, we process your email address, your name, and the profile details your sign-in provider shares (GitHub or Google), plus the sites, domains, and settings you configure. Secret keys are stored only as hashes.",
        "We record usage (checks verified, by site, type, and hour) to bill you and show your dashboard. Payments are handled by Stripe; we don't receive or store card numbers.",
      ],
    },
    {
      heading: "Verification tokens",
      paragraphs: [
        "Each completed check produces a token that the website's server verifies with us. We store a hash of the token with the site, action, hostname, the type of check passed, a risk score, and timestamps. Tokens can be verified once, within five minutes.",
      ],
    },
    {
      heading: "Service providers",
      paragraphs: [
        "We use Vercel to host the service, a managed database provider to store the data described here, Resend to send account emails, Stripe for payments, and GitHub and Google for sign-in. They process data only to provide their services to us.",
      ],
    },
    {
      heading: "Customers' responsibilities",
      paragraphs: [
        "Customers decide where checks run and which checks are required. They are responsible for telling their own visitors that they use BotRepel, and for any consent their laws require.",
      ],
    },
    {
      heading: "Biometric privacy laws",
      paragraphs: [
        "The light check detects whether a live face is present; it doesn't identify anyone or create biometric templates. Because some laws (including in Illinois, Texas, and Washington) regulate face data broadly, we show notice and ask you to continue before any camera use, process frames only in memory, and keep none. You can decline and leave the check at any time.",
      ],
    },
    {
      heading: "Retention and deletion",
      paragraphs: [
        "Face crops are discarded at the end of each request. Verification tokens and challenges are deleted a day after they expire, and with them any record of which Human Pass was used on which website. Rate-limit records are deleted within hours. Abuse reports are deleted after 90 days, and the numeric light-check measurements after 180 days.",
        "We keep account, usage, and billing records while your account is open and as long as required for accounting and legal obligations. You can download your data or delete your account at any time from Settings in your dashboard.",
      ],
    },
    {
      heading: "Your rights",
      paragraphs: [
        `Depending on where you live, you may have rights to access, correct, delete, or object to the processing of your personal data. Email ${CONTACT_EMAIL}. Because we don't store visitors' names, emails, or faces, we may be unable to find visitor data that isn't linked to anything you can give us.`,
      ],
    },
    {
      heading: "Children",
      paragraphs: [
        `${SITE_NAME} isn't directed at children, and customers may not use it to collect children's personal data.`,
      ],
    },
    {
      heading: "Changes and contact",
      paragraphs: [
        `We'll post changes here and update the date above; for material changes we'll also email customers. Questions: ${CONTACT_EMAIL}, or ${OPERATOR}, ${OPERATOR_ADDRESS}.`,
      ],
    },
  ],
};

export const TERMS: LegalDocument = {
  title: "Terms of service",
  updated: "October 27, 2026",
  intro: `These terms are an agreement between you and ${OPERATOR} ("we"), which operates ${SITE_NAME}. They govern your use of ${SITE_NAME}'s website, dashboard, API, widget, CLI, and SDKs (the "service"). By creating an account or using the service, you agree to them. If you use it for an organization, you agree on its behalf.`,
  sections: [
    {
      heading: "The service",
      paragraphs: [
        `${SITE_NAME} estimates whether a person is present when someone uses your website, and returns a token your server verifies. It reduces automated abuse. It is not identity verification, age verification, or fraud screening, and it must not be used as the sole basis for decisions with legal or similarly significant effects on a person.`,
      ],
    },
    {
      heading: "Your account",
      paragraphs: [
        "Keep your secret keys and sign-in secure; you're responsible for activity under your account. Tell us promptly if you suspect unauthorized use.",
      ],
    },
    {
      heading: "Fees and credit",
      paragraphs: [
        `New accounts receive ${formatDollars(FREE_CREDIT_MICROS, 0)} of free usage once, when they first sign in with GitHub or Google. After that, you prepay credit and are charged per verification at the prices on our website, only when your server successfully verifies a token. Prices may change with 30 days' notice; changes don't affect credit already purchased. Except where the law requires otherwise, credit is non-refundable and doesn't expire while your account is open.`,
        "If your credit runs out, the service follows the setting you chose for each site: fall back to the invisible check, or fail closed.",
      ],
    },
    {
      heading: "Your obligations",
      paragraphs: [
        "You'll tell your visitors that you use BotRepel and obtain any consent your laws require, comply with applicable laws, and use the service only on domains you control.",
      ],
    },
    {
      heading: "Acceptable use",
      paragraphs: [
        "Don't attempt to circumvent, reverse engineer for evasion, overload, or resell the service; don't use it to identify, track, or profile people; and don't use it to infer sensitive traits such as emotion, health, or ethnicity.",
      ],
    },
    {
      heading: "No guarantee",
      paragraphs: [
        'Verification is probabilistic. Some automated traffic will pass and some people will be asked to retry. The service is provided "as is" and "as available", without warranties of any kind, to the extent permitted by law.',
      ],
    },
    {
      heading: "Liability",
      paragraphs: [
        "To the extent permitted by law, BotRepel isn't liable for indirect, incidental, special, consequential, or punitive damages, or lost profits or data. Our total liability for any claim is limited to the amount you paid us in the 12 months before the claim.",
      ],
    },
    {
      heading: "Suspension and termination",
      paragraphs: [
        "You can stop using the service and delete your account at any time from Settings. We may suspend or end access for violations of these terms or to protect the service or others, with notice where practical.",
      ],
    },
    {
      heading: "Governing law",
      paragraphs: [
        "These terms are governed by the laws of the State of New York, without regard to its conflict-of-laws rules. Any dispute will be resolved in the state or federal courts located in New York County, New York, and both parties consent to their jurisdiction.",
      ],
    },
    {
      heading: "Changes and contact",
      paragraphs: [
        `We may update these terms; we'll post changes here and email customers about material ones. Continuing to use the service after changes take effect means you accept them. Questions: ${CONTACT_EMAIL}, or ${OPERATOR}, ${OPERATOR_ADDRESS}.`,
      ],
    },
  ],
};

/** The data processing addendum customers subject to the GDPR (or similar laws) ask for. */
export const DPA: LegalDocument = {
  title: "Data processing addendum",
  updated: "October 27, 2026",
  intro: `This addendum forms part of the terms of service between ${OPERATOR} ("processor") and a customer ("controller") when ${SITE_NAME} processes personal data of the customer's website visitors on the customer's behalf. It applies automatically; no signature is needed.`,
  sections: [
    {
      heading: "Subject matter and duration",
      paragraphs: [
        `We process visitor data only to run checks the customer's websites request and to return verification results, for as long as the customer uses ${SITE_NAME}.`,
      ],
    },
    {
      heading: "Data and data subjects",
      paragraphs: [
        "Data subjects are visitors to the customer's websites. Categories: a keyed hash of the IP address, browser automation signals, the website hostname and protected action, and, for the light check only, low-resolution face crops processed in memory and never stored. For Human Pass: a passkey's public key, credential ID, and counter.",
      ],
    },
    {
      heading: "Our obligations",
      paragraphs: [
        "We process personal data only on the customer's documented instructions (the service configuration), keep it confidential, protect it with appropriate technical and organizational measures (encryption in transit, hashing of secrets and tokens, least-privilege access, deletion on the schedule in our privacy policy), and assist the customer with data-subject requests and security incidents.",
        "We notify the customer without undue delay after becoming aware of a personal data breach affecting their visitors.",
      ],
    },
    {
      heading: "Subprocessors",
      paragraphs: [
        "Vercel Inc. (hosting and compute), Neon Inc. (database), Resend Inc. (account email; no visitor data), Stripe Inc. (payments; no visitor data), GitHub Inc. and Google LLC (customer sign-in; no visitor data). We'll announce new subprocessors on this page at least 30 days before they process visitor data; customers may object by closing their account.",
      ],
    },
    {
      heading: "International transfers",
      paragraphs: [
        "Data is processed in the United States. Where the GDPR applies, the EU Standard Contractual Clauses (Module 2, controller to processor) are incorporated by reference, with this addendum supplying their annexes.",
      ],
    },
    {
      heading: "Deletion and audits",
      paragraphs: [
        `On account deletion, the customer's configuration is deleted immediately and visitor records follow the retention schedule in our privacy policy. On reasonable notice, we'll answer the customer's written security questions; contact ${CONTACT_EMAIL}.`,
      ],
    },
  ],
};
