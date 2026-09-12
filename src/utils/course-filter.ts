/**
 * Waterloo LEARN MCP Server
 * Copyright (c) 2026 Rohan Muppa. All rights reserved.
 * Licensed under MIT — see LICENSE file for details.
 */

import type { CourseFilterConfig } from "../types/index.js";
import { log } from "./logger.js";

interface FilterableCourse {
  id: number;
  isActive: boolean;
  /**
   * D2L's own verdict on whether the course is still open. Distinct from
   * isActive, which describes the enrollment and stays true for a course that
   * ended years ago. Optional because not every tenant sends it, and a course
   * we know nothing about must not be hidden.
   */
  canAccess?: boolean;
}

/**
 * Apply course filtering based on environment variable configuration.
 *
 * Filter priority:
 * 1. activeOnly — exclude inactive courses (default: true)
 * 2. includeCourseIds — whitelist (only these courses)
 * 3. excludeCourseIds — blacklist (remove these courses)
 *
 * Tool-level courseId params bypass this filter entirely —
 * if user explicitly requests courseId=X, honor it regardless of config.
 */
export function applyCourseFilter<T extends FilterableCourse>(
  courses: T[],
  config: CourseFilterConfig
): T[] {
  let filtered = courses;
  const originalCount = courses.length;

  if (config.activeOnly) {
    filtered = filtered.filter(c => c.isActive);
    // Skip inaccessible closed courses even when enrollment remains active.
    filtered = filtered.filter(c => c.canAccess !== false);
  }

  if (config.includeCourseIds && config.includeCourseIds.length > 0) {
    filtered = filtered.filter(c => config.includeCourseIds!.includes(c.id));
  }

  if (config.excludeCourseIds && config.excludeCourseIds.length > 0) {
    filtered = filtered.filter(c => !config.excludeCourseIds!.includes(c.id));
  }

  if (filtered.length !== originalCount) {
    log("DEBUG", `Course filter: ${originalCount} -> ${filtered.length} courses`, {
      activeOnly: config.activeOnly,
      include: config.includeCourseIds,
      exclude: config.excludeCourseIds,
    });
  }

  return filtered;
}
