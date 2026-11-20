/** The message of whatever was thrown, for showing to the user. */
export function describeError(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
