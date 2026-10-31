import { isProduction } from "./env";
import { requestNotes } from "./request-log";

type Level = "info" | "warn" | "error";

/** Never include PII. */
export type LogAttributes = Record<string, string | number | boolean | null | undefined>;

const WRITERS: Record<Level, (line: string) => void> = {
  info: (line) => console.info(line),
  warn: (line) => console.warn(line),
  error: (line) => console.error(line),
};

/** Production writes one JSON object per line for Vercel log search. */
export class Logger {
  private readonly label: string;
  private readonly attributes: LogAttributes;

  public constructor(label: string, attributes: LogAttributes = {}) {
    this.label = label;
    this.attributes = attributes;
  }

  public info(message: string, attributes?: LogAttributes): void {
    this.write("info", message, attributes);
  }

  public warn(message: string, attributes?: LogAttributes): void {
    this.write("warn", message, attributes);
  }

  public error(message: string, attributes?: LogAttributes): void {
    this.write("error", message, attributes);
  }

  public child(attributes: LogAttributes): Logger {
    return new Logger(this.label, { ...this.attributes, ...attributes });
  }

  private write(level: Level, message: string, attributes?: LogAttributes): void {
    const { requestId } = requestNotes();
    const merged: LogAttributes = { requestId, ...this.attributes, ...attributes };
    if (isProduction()) {
      WRITERS[level](JSON.stringify({ level, label: this.label, message, ...merged }));
      return;
    }
    const extras = Object.values(merged).some((value) => value !== undefined) ? ` ${JSON.stringify(merged)}` : "";
    WRITERS[level](`[${this.label}] ${message}${extras}`);
  }
}
