import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BrowserAuth, BrowserAuthTransportError } from "../../src/auth/browser-auth.js";
import { InteractiveLoginError, MANUAL_LOGIN_TIMEOUT_MS } from "../../src/auth/auth-policy.js";
import type { AppConfig } from "../../src/types/index.js";

const BASE_URL = "https://learn.uwaterloo.ca";

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    baseUrl: BASE_URL,
    sessionDir: "/tmp/does-not-matter",
    tokenTtl: 3600,
    username: "student@example.edu",
    courseFilter: {} as AppConfig["courseFilter"],
    ...overrides,
  };
}

interface FakeState {
  url: string;
  cookies: Array<{ name: string; value: string }>;
  d2l: boolean;
  visible: string[];
}

interface FakePageOptions {
  url?: string;
  /** A live session: the cookie alone is not enough, D2L.LP has to answer too. */
  cookies?: Array<{ name: string; value: string }>;
  d2l?: boolean;
  /** Selectors (and "text:..." keys) the page reports as on screen. */
  visible?: string[];
  /** Mutate the page between polls, the way a real redirect chain would. */
  onTick?: (state: FakeState) => void;
}

/**
 * Fake Page for Waterloo login polling; records any unintended clicks.
 */
function makePage(options: FakePageOptions = {}) {
  const state: FakeState = {
    url: options.url ?? `${BASE_URL}/d2l/home`,
    cookies: options.cookies ?? [],
    d2l: options.d2l ?? false,
    visible: options.visible ?? [],
  };
  const clicks: string[] = [];

  const target = (key: string) => ({
    first: () => ({
      isVisible: async () => state.visible.includes(key),
      click: async () => {
        clicks.push(key);
      },
    }),
  });

  const page = {
    isClosed: vi.fn(() => false),
    goto: vi.fn(async () => null),
    url: vi.fn(() => state.url),
    waitForURL: vi.fn(async () => {
      throw new Error("Timeout waiting for URL");
    }),
    waitForLoadState: vi.fn(async () => {}),
    waitForTimeout: vi.fn(async (ms: number) => {
      vi.advanceTimersByTime(ms);
      options.onTick?.(state);
    }),
    // Runs the real predicate against a stubbed window, so the test exercises
    // the same expression the browser would.
    evaluate: vi.fn(async (fn: () => unknown) => {
      const globals = globalThis as unknown as Record<string, unknown>;
      const previous = globals.window;
      globals.window = state.d2l ? { D2L: { LP: {} } } : {};
      try {
        return fn();
      } finally {
        if (previous === undefined) delete globals.window;
        else globals.window = previous;
      }
    }),
    context: vi.fn(() => ({ cookies: vi.fn(async () => state.cookies) })),
    locator: vi.fn((selector: string) => target(selector)),
    getByText: vi.fn((text: string) => target(`text:${text}`)),
  };

  return { page, clicks, state };
}

const LIVE_SESSION = {
  cookies: [{ name: "d2lSessionVal", value: "abc123" }],
  d2l: true,
};

describe("Waterloo browser login", () => {
  let auth: BrowserAuth;
  beforeEach(() => { vi.useFakeTimers(); auth = new BrowserAuth(makeConfig()); });
  afterEach(() => { vi.useRealTimers(); });
  const navigate = (page: unknown): Promise<boolean> => (auth as any).navigateAndLogin(page);

  it("accepts an already authenticated LEARN home", async () => {
    const { page } = makePage({ ...LIVE_SESSION });
    await expect(navigate(page)).resolves.toBe(true);
    expect(page.waitForTimeout).not.toHaveBeenCalled();
  });

  it("waits through SSO redirects without clicking or entering credentials", async () => {
    const { page, clicks } = makePage({ url: "https://sso.example.edu/login", onTick: state => {
      Object.assign(state, LIVE_SESSION, { url: `${BASE_URL}/d2l/home/123` });
    } });
    await expect(navigate(page)).resolves.toBe(false);
    expect(clicks).toEqual([]);
  });

  it.each([
    { url: `${BASE_URL}/d2l/login`, ...LIVE_SESSION },
    { url: `${BASE_URL}/d2l/home`, cookies: LIVE_SESSION.cookies, d2l: false },
    { url: "https://other.example/d2l/home", ...LIVE_SESSION },
  ])("rejects a login shell, partial session, or foreign origin", async options => {
    const { page } = makePage(options);
    const start = Date.now();
    await expect(navigate(page)).rejects.toBeInstanceOf(InteractiveLoginError);
    expect(Date.now() - start).toBe(MANUAL_LOGIN_TIMEOUT_MS);
  });

  it("reports a closed window as interrupted login", async () => {
    const { page } = makePage();
    page.isClosed.mockReturnValue(true);
    await expect(navigate(page)).rejects.toBeInstanceOf(InteractiveLoginError);
  });

  it("handles a window closed during the polling wait", async () => {
    const { page } = makePage();
    page.waitForTimeout.mockImplementation(async () => {
      page.isClosed.mockReturnValue(true);
      throw new Error("Target closed");
    });
    await expect(navigate(page)).rejects.toBeInstanceOf(InteractiveLoginError);
  });

  it("retries transient JavaScript context destruction during redirects", async () => {
    const { page } = makePage({ ...LIVE_SESSION });
    page.evaluate.mockRejectedValueOnce(new Error("Execution context was destroyed"));
    await expect(navigate(page)).resolves.toBe(false);
  });

  it("preserves real browser transport failures", async () => {
    const { page } = makePage({ ...LIVE_SESSION });
    page.evaluate.mockRejectedValue(new Error("Browser transport unavailable"));
    await expect(navigate(page)).rejects.toBeInstanceOf(BrowserAuthTransportError);
  });

  it("continues polling after initial navigation times out", async () => {
    const { page } = makePage({ ...LIVE_SESSION });
    page.goto.mockRejectedValue(new Error("Timeout 60000ms exceeded"));
    await expect(navigate(page)).resolves.toBe(true);
  });

  it("preserves session state on a server outage", async () => {
    const { page } = makePage();
    page.goto.mockResolvedValue({ status: () => 503 } as any);
    await expect(navigate(page)).rejects.toBeInstanceOf(BrowserAuthTransportError);
    expect(page.waitForTimeout).not.toHaveBeenCalled();
  });
});
