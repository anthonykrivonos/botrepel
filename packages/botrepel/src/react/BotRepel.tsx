import {
  DEFAULT_API_ORIGIN,
  isWidgetMessage,
  TOKEN_FIELD,
  widgetUrl,
  type Assurance,
  type HostToWidget,
  type WidgetErrorCode,
} from "@botrepel/protocol";
import { useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type Ref } from "react";

export interface BotRepelHandle {
  /** Starts a check when `mode="execute"`; harmless otherwise. */
  execute(): void;
  /** Clears the current token, e.g. after a failed form submission. */
  reset(): void;
  /** The current token, or null. */
  getResponse(): string | null;
}

export interface BotRepelProps {
  /** Your site key (`br_pk_…`), safe to expose in the browser. */
  readonly siteKey: string;
  /** What this form protects, e.g. "signup". Policies and siteverify use it. */
  readonly action?: string;
  /** Require at least this assurance here, on top of the site's policy. */
  readonly minAssurance?: Assurance;
  readonly theme?: "dark" | "light" | "auto";
  /** `auto` checks as soon as the widget loads; `execute` waits for `ref.execute()`. */
  readonly mode?: "auto" | "execute";
  /** The hidden input carrying the token in a native form submission. */
  readonly inputName?: string;
  readonly onVerify?: (token: string, assurance: Assurance) => void;
  readonly onError?: (code: WidgetErrorCode, message: string) => void;
  /** The token expired before use; the widget fetches a new one by itself in `auto` mode. */
  readonly onExpire?: () => void;
  readonly className?: string;
  /** For self-hosting or local development. */
  readonly apiOrigin?: string;
  readonly ref?: Ref<BotRepelHandle>;
}

const FRAME_STYLE: CSSProperties = { width: 300, height: 64, border: 0, colorScheme: "normal", display: "block" };
const EXPANDED_STYLE: CSSProperties = {
  width: "100%",
  height: "100%",
  border: 0,
  colorScheme: "normal",
  display: "block",
};
/** Inline, the dialog is an unstyled box around the frame. */
const DIALOG_STYLE: CSSProperties = {
  position: "static",
  margin: 0,
  padding: 0,
  border: 0,
  background: "transparent",
  color: "inherit",
};
const MODAL_STYLE: CSSProperties = {
  ...DIALOG_STYLE,
  position: "fixed",
  inset: 0,
  width: "100vw",
  height: "100dvh",
  maxWidth: "none",
  maxHeight: "none",
  overflow: "hidden",
};

/** The camera for the flash check and passkeys for Human Pass are delegated to the widget frame only. */
const FRAME_PERMISSIONS = "camera; publickey-credentials-get; publickey-credentials-create";

export function BotRepel({
  siteKey,
  action,
  minAssurance,
  theme,
  mode = "auto",
  inputName = TOKEN_FIELD,
  onVerify,
  onError,
  onExpire,
  className,
  apiOrigin = DEFAULT_API_ORIGIN,
  ref,
}: BotRepelProps): React.JSX.Element {
  const frame = useRef<HTMLIFrameElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const callbacks = useRef({ onVerify, onError, onExpire });
  callbacks.current = { onVerify, onError, onExpire };

  // The host's origin is known only in the browser, so the frame mounts after hydration.
  useEffect(() => {
    setSrc(widgetUrl(apiOrigin, { siteKey, hostOrigin: window.location.origin, action, minAssurance, theme, mode }));
  }, [apiOrigin, siteKey, action, minAssurance, theme, mode]);

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      if (!isWidgetMessage(event, apiOrigin, frame.current?.contentWindow)) {
        return;
      }
      const message = event.data;
      switch (message.type) {
        case "botrepel:token":
          setToken(message.token);
          callbacks.current.onVerify?.(message.token, message.assurance);
          break;
        case "botrepel:error":
          setToken(null);
          callbacks.current.onError?.(message.code, message.message);
          break;
        case "botrepel:expired":
          setToken(null);
          callbacks.current.onExpire?.();
          break;
        case "botrepel:expand":
          setExpanded(message.expanded);
          break;
        case "botrepel:ready":
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [apiOrigin]);

  // A transformed or filtered ancestor would contain a fixed frame, so the expanded check opens in the
  // top layer as a modal dialog. The frame never moves in the DOM, which would reload it.
  useEffect(() => {
    const element = dialog.current;
    if (!element || expanded === element.matches(":modal")) {
      return;
    }
    element.close();
    if (expanded) {
      element.showModal();
    } else {
      element.show();
    }
  }, [expanded, src]);

  useImperativeHandle(ref, () => {
    const send = (message: HostToWidget): void =>
      frame.current?.contentWindow?.postMessage(message, new URL(apiOrigin).origin);
    return {
      execute: () => send({ type: "botrepel:execute" }),
      reset: () => {
        setToken(null);
        send({ type: "botrepel:reset" });
      },
      getResponse: () => token,
    };
  }, [apiOrigin, token]);

  return (
    <div className={className} data-botrepel="">
      {src && (
        // The widget closes its own expanded step, so Escape on the host page doesn't.
        <dialog
          ref={dialog}
          open
          aria-label="BotRepel human verification"
          style={expanded ? MODAL_STYLE : DIALOG_STYLE}
          onCancel={(event) => event.preventDefault()}
        >
          <iframe
            ref={frame}
            src={src}
            title="BotRepel human verification"
            allow={FRAME_PERMISSIONS}
            style={expanded ? EXPANDED_STYLE : FRAME_STYLE}
          />
        </dialog>
      )}
      <input type="hidden" name={inputName} value={token ?? ""} />
    </div>
  );
}
