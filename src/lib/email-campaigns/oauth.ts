import "server-only";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { OAuth2Client } from "google-auth-library";

/**
 * Server-side Google OAuth 2.0 (authorization code flow), via the official
 * google-auth-library — no homemade OAuth protocol, per Google's own
 * guidance for web server apps. See docs/gmail-integration.md for the
 * Google Cloud Console setup this depends on.
 *
 * Smallest practical scope for sending only — no Gmail read access.
 */
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

const STATE_COOKIE = "gmail_oauth_state";
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — just long enough for the Google consent screen

export class GoogleOAuthNotConfiguredError extends Error {
  constructor() {
    super("Gmail isn't configured for this deployment yet. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.");
    this.name = "GoogleOAuthNotConfiguredError";
  }
}

export class OAuthStateMismatchError extends Error {
  constructor() {
    super("This authorization request expired or was tampered with. Try connecting Gmail again.");
    this.name = "OAuthStateMismatchError";
  }
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

export function createOAuthClient(): OAuth2Client {
  if (!isGoogleOAuthConfigured()) throw new GoogleOAuthNotConfiguredError();
  return new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
}

/** Sets the CSRF state cookie and returns the Google consent-screen URL to redirect the admin to. */
export async function buildAuthorizationUrl(): Promise<string> {
  const client = createOAuthClient();
  const state = randomBytes(24).toString("hex");

  const store = await cookies();
  store.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_MS / 1000,
  });

  return client.generateAuthUrl({
    access_type: "offline", // required to receive a refresh_token
    scope: [GMAIL_SEND_SCOPE],
    state,
    prompt: "consent", // forces a refresh_token even on a re-connect, not just the very first grant
  });
}

/** Validates the callback's `state` against the cookie set in buildAuthorizationUrl(), then clears it either way. */
export async function consumeOAuthState(receivedState: string | null): Promise<void> {
  const store = await cookies();
  const expected = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);

  if (!expected || !receivedState || expected !== receivedState) {
    throw new OAuthStateMismatchError();
  }
}
