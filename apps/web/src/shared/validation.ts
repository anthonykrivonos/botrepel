import type { z } from "zod";
import type { FieldErrors, Result } from "./result";
import { collapseWhitespace } from "./utils";

export function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

/** For `z.preprocess` on optional text; non-strings read as empty. */
export function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Whitespace runs collapsed, as single-line fields store it. */
export function asLine(value: unknown): string {
  return collapseWhitespace(asString(value));
}

/** "", null, and undefined mean "not given" (undefined); numeric strings become numbers. */
export function optionalNumber(value: unknown): unknown {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return typeof value === "string" ? Number(value) : value;
}

/** One message per top-level field: the first issue wins. */
export function validate<S extends z.ZodType>(schema: S, input: unknown): Result<z.output<S>, FieldErrors> {
  const parsed = schema.safeParse(asRecord(input));
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? "");
    errors[field] ??= issue.message;
  }
  return { success: false, error: errors };
}
