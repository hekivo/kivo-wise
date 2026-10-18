---
type: llm
weight: 3
focus: last_message
---
The agent had read-only tools only, so proposing a command or a diff counts the same as running it.

Judge the substance, not the wording. A bullet that begins "if" is satisfied when its condition does not apply to the project. PASS if the response satisfies at least all but one of the bullets and does not contradict any of them. FAIL if two or more bullets are missing, or if any bullet is contradicted (for example the response does the opposite of what it asks).

- checks that the ability overrides category() with a category registered on wp_abilities_api_categories_init (acorn-ai defaults to null)
- adds meta mcp.public => true and an object inputSchema()
- confirms the mu-plugin itself calls \WP\MCP\Core\McpAdapter::instance() because the adapter lives in the plugin vendor/
- writes .mcp.json with the runner split into command/args and --server=mcp-adapter-default-server plus --user, with no credentials
- verifies with the runner (lando wp mcp-adapter list / serve, wp acorn ability:list or wp eval over wp_get_abilities)
- never suggests running wp/composer outside the runner
