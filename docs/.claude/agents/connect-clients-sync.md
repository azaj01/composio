# Connect Clients Sync

Syncs AI client definitions from the dashboard repo (`ComposioHQ/composio_dashboard`) to the Composio Connect docs page.

## When This Runs

Runs daily at 8 AM UTC via cron, or manually via workflow_dispatch. Creates a PR if client definitions have changed.

## Source of Truth

The dashboard repo's client definitions file:
```
ComposioHQ/composio_dashboard
src/app/(connect)/[org]/~/connect/clients/_components/client-definitions.ts
```

This file contains the `ALL_CLIENTS` array with every client's:
- `id`, `name`, `description`, `icon`, `category`
- `authMethods` with step-by-step setup instructions
- Auth types: `oauth` and/or `api-key`

## Target File

```
docs/content/docs/composio-connect.mdx
```

## Process

1. Fetch `client-definitions.ts` from `ComposioHQ/composio_dashboard` (main branch) using the GitHub API
2. Read the current `docs/content/docs/composio-connect.mdx`
3. Compare the client list, categories, and setup steps
4. If there are differences, update `composio-connect.mdx` to match the dashboard

## MDX Structure

The page uses `<ConnectFlow>` and `<ConnectClientOption>` components:

```mdx
<ConnectFlow>

<ConnectClientOption id="client-id" name="Client Name" description="..." icon="/images/clients/logo.svg" category="popular|ide|other">

<Steps>
<Step>
<StepTitle>Step title</StepTitle>

Step description.

</Step>
</Steps>

</ConnectClientOption>

</ConnectFlow>
```

### Category Mapping

Only these 4 clients should have `category="popular"` (shown as tabs):
- `claude-code`
- `codex`
- `openclaw`
- `claude-desktop`

All other clients go in the dropdown:
- Dashboard `IDEs` category → `category="ide"`
- Everything else → `category="other"`

### Auth Method Selection

For the docs page, use the **API key** auth method steps when available. For OAuth-only clients (like Claude Desktop, ChatGPT), use the OAuth steps.

For API key clients, always prepend this step before the client-specific steps:

```mdx
<Step>
<StepTitle>Get your API key</StepTitle>

Open the [Composio dashboard](https://dashboard.composio.dev) and click **AI Clients** in the sidebar. Select your client and copy your API key.

</Step>
```

### Code Blocks

- Use `YOUR_API_KEY` as the placeholder (not the `${token}` variable from the dashboard)
- Use `https://connect.composio.dev/mcp` as the MCP URL (not the `${MCP_URL}` variable)
- Detect the correct language: `bash` for CLI commands, `toml` for TOML config, `json` for JSON config, `text` for plain text/prompts
- Include the `title` attribute from the dashboard's `label` field when present

### Client Logos

Client logos live in `docs/public/images/clients/`. If a new client is added in the dashboard, download its logo from the dashboard repo. The dashboard stores logos at:
- `public/images/clients/`
- `public/images/logos/`

Save all logos to `docs/public/images/clients/` and reference them as `/images/clients/filename.ext` in the MDX.

### Client Order

Popular tab clients come first (in the order listed above), then other clients in the order they appear in the dashboard's `ALL_CLIENTS` array.

## What NOT to Change

- Do NOT modify the frontmatter (title, description) unless new clients need to be added to keywords
- Do NOT modify the intro text ("Give any AI agent...")
- Do NOT modify the "Connect your apps" section at the bottom
- Do NOT modify `connect-flow.tsx` or other component files
- Do NOT modify `source.ts` or `mdx-components.tsx`

## Rules

- Only modify `docs/content/docs/composio-connect.mdx` and files in `docs/public/images/clients/`
- Match the exact step text from the dashboard (resolve template variables like `${MCP_URL}` and `${token}`)
- If a client has `comingSoon: true` in the dashboard, skip it
- If no changes are needed, make no file changes
- Keep the `keywords` frontmatter array updated with all client names (lowercase)
