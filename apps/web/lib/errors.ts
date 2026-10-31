const MAX_CAUSE_DEPTH = 8;

export interface SerializedError {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly cause?: SerializedError;
}

/** Round-trippable form of any thrown value, following `cause` chains. */
export function serializeErrorToObject(error: unknown, depth = MAX_CAUSE_DEPTH): SerializedError {
  if (!(error instanceof Error)) {
    return { name: "Error", message: String(error) };
  }
  return {
    name: error.name,
    message: error.message,
    ...(error.stack ? { stack: error.stack } : {}),
    ...(error.cause !== undefined && depth > 0 ? { cause: serializeErrorToObject(error.cause, depth - 1) } : {}),
  };
}

export function serializeError(error: unknown): string {
  return JSON.stringify(serializeErrorToObject(error));
}
