#!/usr/bin/env node
/** Waterloo-only setup for the local Brightspace MCP fork. */

import * as readline from "node:readline";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import {
  configStoreExists,
  getConfigStorePath,
  loadConfigStore,
  type ConfigStoreData,
} from "./utils/config-store.js";
import { saveSecureConfig } from "./utils/secure-config.js";
import { WATERLOO_BRIGHTSPACE_URL } from "./utils/config.js";

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function runAuth(): Promise<boolean> {
  const scriptPath = path.resolve(thisDir, "auth-cli.js");

  return new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      [scriptPath],
      {
        timeout: 10 * 60 * 1000,
        env: { ...process.env },
      },
      (error) => {
        resolve(!error);
      },
    );
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
  });
}

async function main(): Promise<void> {
  process.on("SIGINT", () => {
    console.log("\n\nSetup cancelled.");
    process.exit(0);
  });

  const existing = configStoreExists() ? loadConfigStore() : {};
  const previousUsername = existing.username ?? "";

  console.log("");
  console.log(bold("Waterloo Brightspace MCP Setup"));
  console.log("==============================");
  console.log(dim(`  Brightspace URL: ${WATERLOO_BRIGHTSPACE_URL}`));
  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const suffix = previousUsername ? ` [${previousUsername}]` : "";
  const enteredUsername = await ask(rl, `Waterloo username/email${suffix}: `);
  const username = enteredUsername || previousUsername || undefined;

  const config: ConfigStoreData = {
    ...existing,
    baseUrl: WATERLOO_BRIGHTSPACE_URL,
    username,
    headless: false,
  };
  delete config.password;
  delete config.campus;

  await saveSecureConfig(config);
  console.log(green(`\nConfig saved to: ${getConfigStorePath()}`));
  console.log(dim("No password was saved. Login happens in the Waterloo browser page."));

  const authNow = await ask(rl, "\nOpen Waterloo LEARN and authenticate now? (yes/no): ");
  rl.close();

  if (/^y(es)?$/i.test(authNow)) {
    console.log("");
    const ok = await runAuth();
    if (ok) {
      console.log(green("\nAuthentication successful."));
    } else {
      console.log(yellow("\nAuthentication failed. Retry with: node build/auth-cli.js"));
    }
  } else {
    console.log(dim("\nAuthenticate later with: node build/auth-cli.js"));
  }

  console.log("");
  console.log(bold("Local MCP server command"));
  console.log(`  node ${path.resolve(thisDir, "index.js")}`);
  console.log("");
}

main().catch((err) => {
  console.error("Setup failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
