/**
 * Guardrails for pages tagged with llmGuardrails: "direct-execution".
 * Concise rules + key patterns for LLMs generating direct execution code.
 */
export const DIRECT_EXECUTION_GUARDRAILS = `

---

# Composio SDK — Instructions for AI Code Generators

**Context:** This page documents the **direct tool execution API**. For most applications, the session-based pattern (\`composio.create(user_id)\` + \`session.tools()\`) is simpler — but if the user is here, they likely want direct execution.

---

## Key Patterns

### Authenticating Users

Create an **Auth Config** on [platform.composio.dev](https://platform.composio.dev), then use the auth config ID to generate a hosted auth URL:

\`\`\`python
from composio import Composio

composio = Composio()
connection = composio.connected_accounts.link(
    user_id="user_123",
    auth_config_id="ac_...",  # from platform dashboard
)
print(connection.redirect_url)  # send user here to authenticate
\`\`\`

\`\`\`typescript
import { Composio } from "@composio/core";

const composio = new Composio();
const connection = await composio.connectedAccounts.link("user_123", "ac_...", {
    callbackUrl: "https://your-app.com/callback",
});
console.log(connection.redirectUrl); // send user here to authenticate
\`\`\`

### Executing Tools

\`\`\`python
tools = composio.tools.get("user_123", tools=["GITHUB_CREATE_ISSUE"])

result = composio.tools.execute(
    "GITHUB_CREATE_ISSUE",
    {"owner": "org", "repo": "repo", "title": "Bug report"},
    user_id="user_123",
)
\`\`\`

\`\`\`typescript
const tools = await composio.tools.get("user_123", { tools: ["GITHUB_CREATE_ISSUE"] });

const result = await composio.tools.execute("GITHUB_CREATE_ISSUE", {
    userId: "user_123",
    arguments: { owner: "org", repo: "repo", title: "Bug report" },
});
\`\`\`

---

## Rules

1. **\`user_id\` is required** — pass it to \`tools.get()\`, \`tools.execute()\`, and \`provider.handle_tool_calls()\`.
2. **\`tools.execute()\` signature** — Python: \`execute(slug, arguments_dict, *, user_id=...)\` (arguments is the second positional param). TypeScript: \`execute(slug, { userId, arguments })\`.
3. **Provider at init** — \`Composio(provider=OpenAIProvider())\` in Python, \`new Composio({ provider: new OpenAIProvider() })\` in TypeScript. Defaults to OpenAI if omitted.
4. **Correct provider imports** — \`composio_<provider>\` for Python, \`@composio/<provider>\` for TypeScript. For OpenAI Agents SDK use \`composio_openai_agents\` / \`@composio/openai-agents\`.

---

## Terminology Migration (old → current)

If you encounter these terms in error messages, old documentation, or user prompts, translate them to the current equivalents. **Do not use the old terms in generated code or explanations.**

| Old term (v1/v2) | Current term (v3) | In code |
|---|---|---|
| entity ID | user ID | \`user_id\` parameter |
| actions | tools | e.g., \`GITHUB_CREATE_ISSUE\` is a *tool* |
| apps / appType | toolkits | e.g., \`github\` is a *toolkit* |
| integration / integration ID | auth config / auth config ID | \`auth_config_id\` parameter |
| connection | connected account | \`connected_accounts\` namespace |
| ComposioToolSet / OpenAIToolSet | \`Composio\` class with a provider | \`Composio(provider=...)\` |
| toolset | provider | e.g., \`OpenAIProvider\` |

If a user says "entity ID", they mean \`user_id\`. If they say "integration", they mean "auth config". Always respond using the current terminology.
`;
