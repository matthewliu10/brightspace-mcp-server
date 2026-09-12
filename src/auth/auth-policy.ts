/** Shared budgets for Waterloo's interactive login and its parent processes. */
export const MANUAL_LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
// Includes browser launch, initial navigation, token acquisition, and cleanup.
export const AUTH_PROCESS_TIMEOUT_MS = MANUAL_LOGIN_TIMEOUT_MS + 3 * 60 * 1000;
export const LOGIN_RETRY_COOLDOWN_MS = 5 * 60 * 1000;

export class InteractiveLoginError extends Error {
  readonly code = "AUTH_INTERACTIVE";
  constructor(message: string) {
    super(message);
    this.name = "InteractiveLoginError";
  }
}
