import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { assertNativeCredentialStoreAvailable, nativeCredentialBackend } from "../../src/auth/credential-store.js";

describe("Credential store", () => {
  it("requires a real Secret Service on Linux", async () => {
    const missing = vi.fn(async () => { throw new Error("service absent"); });
    await expect(assertNativeCredentialStoreAvailable("linux", missing)).rejects.toThrow("Secret Service");
    expect(missing).toHaveBeenCalledOnce();
    const present = vi.fn(async () => {});
    await expect(assertNativeCredentialStoreAvailable("linux", present)).resolves.toBeUndefined();
  });

  it("does not run Linux probes on macOS or Windows", async () => {
    const probe = vi.fn(async () => {});
    await assertNativeCredentialStoreAvailable("darwin", probe);
    await assertNativeCredentialStoreAvailable("win32", probe);
    expect(probe).not.toHaveBeenCalled();
  });

  it.runIf(process.env.BRIGHTSPACE_TEST_NATIVE_KEYRING === "1")("round-trips and removes a temporary native credential entry", async () => {
    const service = `brightspace-mcp-server-test-${randomUUID()}`;
    const account = "dummy-test-account";
    try {
      expect(await nativeCredentialBackend.getPassword(service, account)).toBeNull();
      await nativeCredentialBackend.setPassword(service, account, "dummy-keyring-test-value");
      expect(await nativeCredentialBackend.getPassword(service, account)).toBe("dummy-keyring-test-value");
    } finally {
      await nativeCredentialBackend.deletePassword(service, account);
    }
    expect(await nativeCredentialBackend.getPassword(service, account)).toBeNull();
  }, 30_000);
});
