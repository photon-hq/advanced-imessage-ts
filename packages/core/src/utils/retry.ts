import type { RetryOptions } from "../types/common.ts";

export type { RetryOptions } from "../types/common.ts";

/** Sensible defaults for retry options. */
export const DEFAULT_RETRY_OPTIONS: Required<
  Pick<RetryOptions, "initialDelay" | "maxAttempts" | "maxDelay">
> = {
  maxAttempts: 4,
  initialDelay: 200,
  maxDelay: 5000,
};
