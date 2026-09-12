# Agent notes for the Waterloo LEARN fork

This repository is the local Waterloo-only Brightspace MCP server. Read
[README.md](README.md) for setup, tool behavior, storage, and configuration.
“LEARN” and “Waterloo LEARN” refer to the `brightspace` MCP connection.

## Work on this checkout

- Build with `npm run build`; test with `npm run test:run`.
- Keep the MCP command pointed at this checkout's absolute `build/index.js`.
- Authenticate from this checkout with `npm run auth`. The user completes
  Waterloo login and Duo in the visible browser. Never request a password or
  attempt to automate Duo approval.
- Preserve encrypted sessions and native encryption-key identifiers when
  refactoring. No login is needed just because the computer restarted.
- Automatic browser retries pause five minutes after a closed/timed-out login;
  explicit authentication bypasses that pause. Do not loop tool calls to
  repeatedly reopen login windows.
- Keep all course tools read-only. Tool availability does not imply every
  endpoint is permitted by the user's enrollment.
- Do not guess Waterloo role IDs or treat unavailable fields as zero. The
  roster uses returned role names and reports its filtering limitation.
- There is no npm publishing or self-update workflow for this private fork.
  Do not replace it with the upstream `brightspace-mcp-server` npm package.

## Code map

- `src/index.ts`: stdio MCP entrypoint and tool registration
- `src/setup.ts`: public Waterloo config and optional interactive login
- `src/auth-cli.ts`: explicit/automatic authentication entrypoint
- `src/auth/browser-auth.ts`: visible login, session verification, token capture
- `src/auth/auth-policy.ts`: shared login budgets and interruption error
- `src/auth/auth-runner.ts`: child process lifetime and progress reporting
- `src/auth/auth-cooldown.ts`: interrupted-login retry pause
- `src/auth/token-manager.ts`: cached token validation and HTTP renewal
- `src/auth/*store.ts`: encrypted session storage and native key storage
- `src/utils/config.ts`: Waterloo URL and supported config resolution
- `src/tools/`: read-only course tools and input schemas
- `src/api/`: API requests, pagination, rate limiting, and version discovery

Generic API and storage tests use synthetic hosts intentionally. Opt-in
Chromium fixtures intercept every request and never log in to real LEARN.
