import { rmSync } from "node:fs";
// Deleted TypeScript modules must not survive in the local runtime build.
rmSync(new URL("../build/", import.meta.url), { recursive: true, force: true });
