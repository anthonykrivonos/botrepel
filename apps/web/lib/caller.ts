/** Who made a request: a dashboard session cookie, or the CLI's bearer session token. */
export interface Caller {
  readonly userId: string;
  readonly via: "session" | "bearer";
  /** An operator: a verified address on ADMIN_EMAILS, signed in with the dashboard cookie. */
  readonly admin: boolean;
}
