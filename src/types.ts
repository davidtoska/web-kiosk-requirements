export type Status = "pending" | "pass" | "fail";

export interface Result {
  status: Status;
  note: string;
  at: number | null;
}

export interface TestContext {
  /** Container the test renders into. */
  root: HTMLElement;
  /** Record an outcome. Ignored once the operator has left the test. */
  setStatus(status: Status, note?: string): void;
  /** Register teardown work (streams, timers, listeners). Runs when leaving the test. */
  onCleanup(fn: () => void): void;
}

export interface Test {
  id: string;
  title: string;
  summary: string;
  run(ctx: TestContext): void;
}
