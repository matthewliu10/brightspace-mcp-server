import * as path from "node:path";
import { acquireProcessLock } from "../auth/auth-lock.js";
import { getConfigStorePath, saveConfigStore, type ConfigStoreData } from "./config-store.js";
import { WATERLOO_BRIGHTSPACE_URL } from "./config.js";

/** Save only supported public settings; discard legacy password and school options. */
export async function saveSecureConfig(config: ConfigStoreData): Promise<void> {
  const release = await acquireProcessLock(path.join(path.dirname(getConfigStorePath()), ".config-write.lock"));
  try {
    saveConfigStore({
      baseUrl: WATERLOO_BRIGHTSPACE_URL,
      username: config.username,
      sessionDir: config.sessionDir,
      tokenTtl: config.tokenTtl,
      includeCourses: config.includeCourses,
      excludeCourses: config.excludeCourses,
      activeOnly: config.activeOnly,
    });
  } finally {
    await release();
  }
}
