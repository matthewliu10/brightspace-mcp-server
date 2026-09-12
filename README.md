# Waterloo Brightspace MCP Server

Local MCP server for Waterloo LEARN at `https://learn.uwaterloo.ca`.

This fork is intentionally narrow:

- Waterloo LEARN is hardcoded.
- Authentication always opens a browser window.
- You log in on the real Waterloo page and complete Duo there.
- The setup command does not ask for or store your password.
- The server does not check npm for updates on startup.
- Brightspace access remains read-only; there are no submit/post/upload tools.

Based on `RohanMuppa/brightspace-mcp-server` v2.0.0.

## Setup

```bash
cd ~/waterloo/brightspace-mcp-server
npm ci --ignore-scripts
npx playwright install chromium
npm run build
node build/setup.js
```

The setup command saves local config under `~/.brightspace-mcp/config.json`.
It may ask for your Waterloo username/email so session files can stay tied to
that account, but it does not save your password.

## Authenticate

```bash
cd ~/waterloo/brightspace-mcp-server
node build/auth-cli.js
```

A browser window opens. Finish Waterloo login and Duo there. Once the page
lands on LEARN, the command saves an encrypted local session.

## MCP Config

Point your MCP client at the local built server:

```json
{
  "command": "node",
  "args": [
    "/Users/matthew/waterloo/brightspace-mcp-server/build/index.js"
  ]
}
```

The MCP client starts the server for you. You usually do not run
`node build/index.js` by hand except for debugging.

## Available Tools

- `check_auth`
- `get_my_courses`
- `get_upcoming_due_dates`
- `get_my_grades`
- `get_announcements`
- `get_assignments`
- `get_assignment_files`
- `get_course_content`
- `download_file`
- `get_classlist_emails`
- `get_roster`
- `get_syllabus`
- `get_discussions`

## Security Notes

Session files are stored under `~/.d2l-session` and encrypted using a key kept
in the operating system credential store. The server talks to Waterloo
Brightspace over HTTPS and uses the saved session until Waterloo expires it.

No assignment submission, discussion posting, file upload, grade changing, or
other Brightspace write tools are registered.
