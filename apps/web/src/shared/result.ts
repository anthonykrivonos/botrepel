/** Outcome of an operation that can fail in an expected way. */
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

/** Field name to a message shown next to that field. */
export type FieldErrors = Record<string, string>;

/** HTTP statuses the domain layer reports; REST returns them as is. */
export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 410 | 413 | 415 | 429 | 502 | 503;

/** An expected failure surfaced to a person or an agent. */
export interface DomainError {
  readonly retryAfter?: number;
  readonly status: ErrorStatus;
  readonly message: string;
  readonly fields?: FieldErrors;
}

export type DomainResult<T> = Result<T, DomainError>;

export function succeed<T>(data: T): { success: true; data: T } {
  return { success: true, data };
}

export function fail(
  status: ErrorStatus,
  message: string,
  fields?: FieldErrors,
  retryAfter?: number,
): { success: false; error: DomainError } {
  return {
    success: false,
    error: {
      status,
      message,
      ...(fields ? { fields } : {}),
      ...(retryAfter === undefined ? {} : { retryAfter }),
    },
  };
}
