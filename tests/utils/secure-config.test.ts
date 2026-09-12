import { beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ save: vi.fn(), release: vi.fn(), acquire: vi.fn() }));
vi.mock("../../src/utils/config-store.js", () => ({ saveConfigStore: fake.save, getConfigStorePath: () => "/dummy/config.json" }));
vi.mock("../../src/utils/config.js", () => ({ WATERLOO_BRIGHTSPACE_URL: "https://learn.uwaterloo.ca" }));
vi.mock("../../src/auth/auth-lock.js", () => ({ acquireProcessLock: fake.acquire }));
import { saveSecureConfig } from "../../src/utils/secure-config.js";
describe("Waterloo public configuration", () => {
  beforeEach(() => { vi.resetAllMocks(); fake.acquire.mockResolvedValue(fake.release); });
  it("discards legacy credentials and unsupported school options", async () => {
    await saveSecureConfig({ baseUrl: "https://old.example", password: "legacy-secret", campus: "Old", headless: true, username: "alice", includeCourses: [123] });
    const saved = fake.save.mock.calls[0][0];
    expect(saved).toMatchObject({ baseUrl: "https://learn.uwaterloo.ca", username: "alice", includeCourses: [123] });
    expect(saved).not.toHaveProperty("password");
    expect(saved).not.toHaveProperty("campus");
    expect(saved).not.toHaveProperty("headless");
    expect(fake.release).toHaveBeenCalledOnce();
  });
  it("releases the writer lock after a failed save", async () => {
    fake.save.mockImplementation(() => { throw new Error("disk full"); });
    await expect(saveSecureConfig({})).rejects.toThrow("disk full");
    expect(fake.release).toHaveBeenCalledOnce();
  });
});
