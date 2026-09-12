/**
 * Brightspace MCP Server
 * Copyright (c) 2026 Rohan Muppa. All rights reserved.
 * Licensed under MIT — see LICENSE file for details.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { writeFileAtomicSync } from "./atomic-write.js";

/** JSON schema for ~/.brightspace-mcp/config.json */
export interface ConfigStoreData {
  baseUrl?: string;
  username?: string;
  /** Legacy input only; discarded by setup. Never written by saveConfigStore. */
  password?: string;
  /** Legacy input only; not used for Waterloo login. */
  campus?: string;
  sessionDir?: string;
  tokenTtl?: number;
  /** Legacy input only; Waterloo login always opens a browser. */
  headless?: boolean;
  includeCourses?: number[];
  excludeCourses?: number[];
  activeOnly?: boolean;
}

const CONFIG_DIR = path.join(os.homedir(), ".brightspace-mcp");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export function configStoreExists(): boolean {
  return fs.existsSync(CONFIG_FILE);
}

export function loadConfigStore(): ConfigStoreData {
  const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
  return JSON.parse(raw) as ConfigStoreData;
}

export function saveConfigStore(config: ConfigStoreData): void {
  if (config.password !== undefined) {
    throw new Error("Waterloo passwords must not be saved in configuration. Use browser login.");
  }
  const isWindows = process.platform === "win32";
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, ...(isWindows ? {} : { mode: 0o700 }) });
  }
  writeFileAtomicSync(
    CONFIG_FILE,
    JSON.stringify(config, null, 2) + "\n",
    isWindows ? {} : { mode: 0o600 }
  );
}

export function getConfigStorePath(): string {
  return CONFIG_FILE;
}
