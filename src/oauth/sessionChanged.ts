import type { StoredLinearSession } from "./types";

export function sessionChanged(
  before: StoredLinearSession,
  after: StoredLinearSession
): boolean {
  return (
    before.accessToken !== after.accessToken ||
    before.refreshToken !== after.refreshToken ||
    before.expiresAt !== after.expiresAt
  );
}
