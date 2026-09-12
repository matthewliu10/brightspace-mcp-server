import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

import { LOGIN_RETRY_COOLDOWN_MS } from "./auth-policy.js";

export class AuthenticationCooldownError extends Error {
  readonly code = "AUTH_COOLDOWN";
  constructor(public readonly retryAt: number) {
    super(`A previous Waterloo login was interrupted. Automatic login resumes at ${new Date(retryAt).toISOString()}. Run npm run auth in the local fork to retry now.`);
    this.name = "AuthenticationCooldownError";
  }
}

/** Non-secret retry metadata. Call only while holding the authentication lock. */
export class AuthCooldown {
  private readonly file: string;
  constructor(sessionDir: string) {
    this.file = path.join(sessionDir, "auth-status.json");
  }

  async assertAllowed(): Promise<void> {
    let content: string;
    try {
      content = await fs.readFile(this.file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    const status = JSON.parse(content) as { retryAt?: number };
    if (typeof status.retryAt === "number" && status.retryAt > Date.now()) throw new AuthenticationCooldownError(status.retryAt);
  }

  async recordLoginFailure(): Promise<void> {
    await this.write({ retryAt: Date.now() + LOGIN_RETRY_COOLDOWN_MS });
  }

  async clear(): Promise<void> {
    await this.write({ retryAt: 0 });
  }

  private async write(status: { retryAt: number }): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(status), { mode: 0o600, flag: "wx" });
    await fs.rename(temporary, this.file);
  }
}
