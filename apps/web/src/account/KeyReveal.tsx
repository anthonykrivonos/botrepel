import { CopyField } from "../components/CopyField";

interface KeyRevealProps {
  readonly siteKey: string;
  readonly secretKey: string;
}

/** The secret is shown once; after this only its first characters are ever visible. */
export function KeyReveal({ siteKey, secretKey }: KeyRevealProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-fg">Site key</p>
        <CopyField value={siteKey} label="Copy site key" />
        <p className="text-xs text-fg-subtle">Public. Goes in your page as BOTREPEL_SITE_KEY.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-fg">Secret key</p>
        <CopyField value={secretKey} label="Copy secret key" />
        <p className="text-xs text-warn">Copy it now. It won't be shown again. Keep it on your server.</p>
      </div>
    </div>
  );
}
