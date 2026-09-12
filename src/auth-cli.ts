#!/usr/bin/env node
/** Brightspace MCP Server. Copyright (c) 2026 Rohan Muppa. MIT licensed. */

import { readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { loadConfig } from "./utils/config.js";
import { BrowserAuth, TokenManager } from "./auth/index.js";
import { NativeCredentialStoreError } from "./auth/credential-store.js";
import { retireLegacyProfile } from "./auth/legacy-profile.js";

dotenv.config({ quiet: true });
const pkg = JSON.parse(readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"));

async function main(): Promise<void> {
  const automatic = process.argv.includes("--automatic");
  if (process.argv.includes("--visible")) process.env.D2L_HEADLESS = "false";
  if (process.argv.includes("--headless")) process.env.D2L_HEADLESS = "true";
  try {
    const config = await loadConfig();
    console.error(`\n=== Brightspace Authentication v${pkg.version} ===\n`);
    if (config.headless) {
      console.error("Authentication runs headlessly. If Microsoft requests MFA, the number appears here.");
    } else {
      console.error("Authentication will open a browser window. Finish your school login and MFA there.");
    }

    const tokenManager = new TokenManager({
      sessionDir: config.sessionDir,
      baseUrl: config.baseUrl,
      tokenTtl: config.tokenTtl,
    });
    await new BrowserAuth(config).authenticate({
      automatic,
      onAuthenticated: async (token) => {
        await tokenManager.setToken(token);
        await retireLegacyProfile(config.sessionDir);
        if (config.legacyBrowserStateMigrated && config.sessionRoot && config.sessionRoot !== config.sessionDir) {
          await retireLegacyProfile(config.sessionRoot);
        }
      },
    });
    console.error("\nAuthentication successful. Your encrypted session is ready for the MCP server.");
  } catch (error) {
    const code = (error as { code?: string })?.code;
    process.exitCode = error instanceof NativeCredentialStoreError ? 5
      : code === "AUTH_IN_PROGRESS" ? 2
      : code === "AUTH_COOLDOWN" ? 3
      : code === "AUTH_UNSUPPORTED" ? 4
      : code === "AUTH_TRANSPORT" ? 6 : 1;
    console.error("\nAuthentication failed:", error instanceof Error ? error.message : "Unknown authentication error");
    console.error("Run `npx brightspace-mcp-server setup` to update saved credentials.");
    console.error("Run `npx brightspace-mcp-server auth` to retry explicitly. This bypasses the automatic MFA cooldown.");
  }
}

await main();
