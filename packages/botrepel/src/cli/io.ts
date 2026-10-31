/** Everything the CLI touches outside itself, so tests can run it against an in-process server. */
export interface Io {
  readonly fetch: typeof fetch;
  readonly cwd: string;
  readonly home: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly interactive: boolean;
  print(line: string): void;
  sleep(ms: number): Promise<void>;
  openUrl(url: string): void;
  /** Runs a command in `cwd`; resolves with its exit code. */
  run(command: string, args: readonly string[]): Promise<number>;
}
