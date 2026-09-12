# Waterloo LEARN MCP

A local, read-only MCP server for the University of Waterloo's **LEARN**
(`https://learn.uwaterloo.ca`), powered by Brightspace. The MCP connection is
named `brightspace`; “LEARN,” “Waterloo LEARN,” and “Brightspace” refer to the
same service here.

This personal fork uses visible Waterloo login and Duo. It does not collect,
store, or enter your Waterloo password. It has no other-school login handlers,
headless login mode, npm update checker, or publishing workflow.

Based on [Rohan Muppa's Brightspace MCP server](https://github.com/RohanMuppa/brightspace-mcp-server),
v2.0.0. Original copyright and MIT license are retained in [LICENSE](LICENSE).

## Setup

You need Node.js 20 or newer, a desktop session for the login window, and an
available operating-system credential store for session encryption keys
(macOS Keychain, Windows Credential Manager, or Linux Secret Service).
Linux requires `secret-tool` and an unlocked Secret Service keyring.

Run these commands from this checkout:

```bash
npm ci --ignore-scripts
npx playwright install chromium
npm run build
npm run setup
```

Setup saves public settings to `~/.brightspace-mcp/config.json` and offers to
open LEARN. The username/email is an optional local account label, not a login
credential. Keep it consistent: changing it selects a separate session folder
and requires another login. With no label, the existing root session folder
is used for compatibility. The label is not checked against the account you
choose in the browser.

Existing session directories and encryption keys retain their names so this
fork can reuse your saved session. Setup strips legacy password, campus, and
headless options from its saved config. It does not delete old passwords from
an operating-system credential store or edit your existing `.env` files.

## Connect your MCP client

Register a server named `brightspace`, using Node and the absolute path to
this checkout's built entrypoint. For this local checkout:

```json
{
  "command": "node",
  "args": ["/Users/matthew/waterloo/brightspace-mcp-server/build/index.js"]
}
```

Adjust the path if you move the checkout. The client starts the server;
`npm start` is available for debugging. The npm package named
`brightspace-mcp-server` is the upstream project, not this fork.

## Login and session renewal

From the checkout, run:

```bash
npm run auth
```

Complete Waterloo sign-in and Duo in the browser window. The server waits up
to ten minutes for the authenticated LEARN home page, then saves encrypted
session state and closes the window. Parent processes allow thirteen minutes
for the whole operation, including startup and token acquisition.

API tokens renew over HTTPS using saved session cookies where possible.
When that no longer works, a tool call can open the login window automatically.
Closing or timing out the login window pauses automatic browser retries for
five minutes. `npm run auth` bypasses that pause. Network failures preserve
saved state and are reported separately. A client may impose a shorter tool
call timeout; running authentication in a terminal avoids that limitation.

Restarting your computer alone does not require a new login: saved encrypted
sessions persist until they expire or Waterloo requires sign-in again.

## Tools

| Tool | Purpose |
| --- | --- |
| `check_auth` | Check authentication and attempt recovery if necessary |
| `get_my_courses` | List enrolled courses |
| `get_upcoming_due_dates` | Upcoming assignment and quiz deadlines |
| `get_my_grades` | Course grades |
| `get_announcements` | Course announcements |
| `get_assignments` | Assignments, quizzes, and grade-only items |
| `get_assignment_files` | Read assignment specs and rubrics |
| `get_course_content` | Course modules and content |
| `download_file` | Download a course file locally |
| `get_classlist_emails` | Classlist names, roles, and emails |
| `get_roster` | Instructors/TAs, or the full visible classlist |
| `get_syllabus` | Find and read syllabus content |
| `get_discussions` | Read discussion forums and posts |

Results depend on what your Waterloo account can access. Missing permissions
are not evidence that an assignment, grade, or discussion does not exist.
The roster matches teaching staff by role display names (instructor,
professor, lecturer, teaching assistant, TA), rather than another university's
role IDs. Custom role names may require `includeStudents=true` to inspect the
full roster.

There are no tools to submit assignments, post discussions, upload course
files, or change grades. Authentication exchanges and local downloads still
write session data and files locally.

## Configuration

Environment variables override the corresponding public config settings:

| Variable | Purpose / default |
| --- | --- |
| `D2L_USERNAME` | Optional stable local account label |
| `D2L_SESSION_DIR` | Session root; defaults to `~/.d2l-session` |
| `D2L_TOKEN_TTL` | Token refresh interval in seconds; defaults to `3600` |
| `D2L_INCLUDE_COURSES` | Comma-separated course IDs to include |
| `D2L_EXCLUDE_COURSES` | Comma-separated course IDs to exclude |
| `D2L_ACTIVE_ONLY` | Active enrollments only; defaults to `true` |

LEARN's URL and visible login are fixed. Legacy `D2L_BASE_URL`, `D2L_HEADLESS`,
`D2L_PASSWORD`, `D2L_CAMPUS`, and MFA automation settings are unused.
See [.env.example](.env.example) for public settings. A `.env` file is loaded
from the process working directory; use setup or explicit MCP environment
settings if the client starts the server elsewhere.

Tokens and browser state use AES-256-GCM encryption with a key held in the OS
credential store. Keep that store available: losing the key makes existing
session files unreadable. Session files use owner-only permissions on Unix.

## Development

```bash
npm run build
npm run test:run
```

Build cleans the generated `build/` directory before compiling, so deleted
login handlers cannot remain in the runtime. `npm run dev` watches TypeScript;
run a full build after deleting source files.

Optional isolated Chromium fixtures (no real Waterloo login):

```bash
BRIGHTSPACE_TEST_BROWSER=1 npm run test:run -- tests/auth/browser-live.test.ts
```

The package is private and this checkout is updated through Git and a local
rebuild. It does not install upstream updates automatically.
