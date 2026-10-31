import { useRef, type ComponentType } from "react";
import { AccountPreview } from "./previews/AccountPreview";
import { AgentSignupPreview } from "./previews/AgentSignupPreview";
import { CommunityPreview } from "./previews/CommunityPreview";
import { ContentPreview } from "./previews/ContentPreview";
import { CreditsPreview } from "./previews/CreditsPreview";
import { LeadsPreview } from "./previews/LeadsPreview";
import { MarketplacePreview } from "./previews/MarketplacePreview";
import type { MiniSitePreviewProps } from "./previews/previewTypes";
import { VoicePreview } from "./previews/VoicePreview";
import type { UseCase } from "./useCaseData";
import { useAnimationActive } from "../hooks/useAnimationActive";
import "./previews/miniSites.css";

const PREVIEWS = {
  "free-credits": CreditsPreview,
  "sms-voice": VoicePreview,
  "credential-stuffing": AccountPreview,
  "marketplace-bots": MarketplacePreview,
  "content-scraping": ContentPreview,
  "fake-leads": LeadsPreview,
  "fake-accounts": CommunityPreview,
  "agent-signup": AgentSignupPreview,
} satisfies Record<UseCase["id"], ComponentType<MiniSitePreviewProps>>;

interface UseCasePreviewProps {
  readonly useCase: UseCase;
  readonly active: boolean;
}

export function UseCasePreview({ useCase, active }: UseCasePreviewProps): React.JSX.Element {
  const ref = useRef<HTMLElement>(null);
  const animationActive = useAnimationActive(ref);
  const Preview = PREVIEWS[useCase.id];
  return (
    <figure ref={ref}>
      <div
        role="img"
        aria-label={`Example website: ${useCase.title}. Verification before ${useCase.verifyBefore.toLowerCase()}.`}
      >
        <div aria-hidden="true">
          <Preview active={active && animationActive} />
        </div>
      </div>
    </figure>
  );
}
