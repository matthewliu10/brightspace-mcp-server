/**
 * Waterloo LEARN MCP Server
 * Copyright (c) 2026 Rohan Muppa. All rights reserved.
 * Licensed under MIT — see LICENSE file for details.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { D2LApiClient, DEFAULT_CACHE_TTLS } from "../api/index.js";
import { fetchAllObjects } from "../api/paginate.js";
import {
  GetRosterSchema,
} from "./schemas.js";
import { toolResponse, sanitizeError } from "./tool-helpers.js";
import { log } from "../utils/logger.js";

interface ClasslistUser {
  Identifier: number;
  DisplayName: string;
  Email: string | null;
  FirstName: string | null;
  LastName: string | null;
  RoleId: number | null;
  ClasslistRoleDisplayName: string;
  IsOnline: boolean;
  LastAccessed: string | null;
}

/**
 * Fetch every classlist user matching the optional filters, across all pages
 */
async function fetchClasslistUsers(
  apiClient: D2LApiClient,
  courseId: number,
  options?: { roleId?: number; searchTerm?: string }
): Promise<ClasslistUser[]> {
  const params = new URLSearchParams();

  if (options?.roleId !== undefined) {
    params.append("roleId", options.roleId.toString());
  }

  if (options?.searchTerm) {
    params.append("searchTerm", options.searchTerm);
  }

  const queryString = params.toString();
  const path = apiClient.le(
    courseId,
    `/classlist/paged/${queryString ? "?" + queryString : ""}`
  );

  return fetchAllObjects<ClasslistUser>(apiClient, path, {
    ttl: DEFAULT_CACHE_TTLS.roster,
  });
}

/**
 * Register get_roster tool
 */
export function registerGetRoster(
  server: McpServer,
  apiClient: D2LApiClient
): void {
  server.registerTool(
    "get_roster",
    {
      title: "Get Course Roster",
      description:
        "Fetch the roster for a course including instructors, TAs, and optionally students with their names, emails, and roles. Use this when the user asks about classmates, instructor contact info, TA emails, professor names, or who's in a class. By default returns only instructors and TAs for privacy. Use includeStudents to get full class list.",
      inputSchema: GetRosterSchema,
    },
    async (args: any) => {
      try {
        log("DEBUG", "get_roster tool called", { args });

        // Parse and validate input
        const { courseId, includeStudents, searchTerm, limit } = GetRosterSchema.parse(args);

        const fetched = await fetchClasslistUsers(apiClient, courseId, { searchTerm });
        const isTeachingRole = (user: ClasslistUser) =>
          /\b(instructor|professor|lecturer|teaching assistant|ta)\b/i.test(user.ClasslistRoleDisplayName ?? "");
        const allUsers = includeStudents ? fetched : fetched.filter(isTeachingRole);

        // A very large roster would swamp the response, so it is capped. The
        // cap is reported in the payload rather than only in a log line the
        // model never sees: a 340 person lecture used to look like a 100
        // person one, with nothing to say otherwise.
        const total = allUsers.length;
        const truncated = total > limit;
        const kept = truncated ? allUsers.slice(0, limit) : allUsers;

        if (truncated) {
          log("WARN", "get_roster: Result set exceeds the limit, truncating", {
            total,
            returned: kept.length,
          });
        }

        // Map to clean output
        const users = kept.map((user) => ({
          name: user.DisplayName,
          email: user.Email || null,
          role: user.ClasslistRoleDisplayName,
        }));

        log("INFO", `get_roster: Retrieved ${users.length} users for course ${courseId}`);
        return toolResponse({
          courseId,
          total,
          returned: users.length,
          truncated,
          ...(truncated
            ? { note: `Showing ${users.length} of ${total}. Raise the limit argument to see more.` }
            : {}),
          ...(!includeStudents ? { roleFilter: "Teaching roles matched from LEARN role display names; use includeStudents=true to inspect all roles." } : {}),
          users,
        });
      } catch (error) {
        return sanitizeError(error);
      }
    }
  );
}
