# MCP Adapter: loading, transports and client config

Deep reference for loading wordpress/mcp-adapter per profile, its HTTP and STDIO transports, custom servers and the project .mcp.json. Loaded on demand from SKILL.md.

Checked against `wordpress/mcp-adapter` 0.5.0. The adapter is pre-1.0 and changes between minors: re-read its `includes/` (and the installed version's migration notes) before relying on a detail.

## How it starts

- `\WP\MCP\Core\McpAdapter::instance()` creates the singleton. Under WP-CLI it initialises on `init` (priority 20), otherwise on `rest_api_init` (priority 15).
- On initialisation it creates the default server (unless `mcp_adapter_create_default_server` returns `false`), fires `mcp_adapter_init` (create custom servers there) and registers the `mcp-adapter` WP-CLI command.
- As an active plugin, its main file calls `instance()` for you. As a library inside an app `vendor/` (typical for `acorn-mu-plugin`), nothing loads that file: call `instance()` yourself, early on `init`, and gate it per environment.

```php
// Plugin/theme bootstrap (acorn-mu-plugin pattern)
add_action('init', function (): void {
    if (! function_exists('wp_register_ability') || ! class_exists(\WP\MCP\Core\McpAdapter::class)) {
        return;
    }
    if (wp_get_environment_type() === 'production' && ! filter_var(getenv('APP_MCP_ENABLED'), FILTER_VALIDATE_BOOLEAN)) {
        return; // keep the HTTP transport off in production unless explicitly enabled
    }
    \WP\MCP\Core\McpAdapter::instance();
}, 0);
```

## Autoloader guard (Bedrock layouts)

The plugin's own loader requires `<plugin dir>/vendor/autoload.php` and stops (admin notice, no command, no routes) when that file is missing. Composer `installer-paths` installs put the plugin under the content `plugins/` dir while its classes are autoloaded from the project's root `vendor/`, so that file never exists. The plugin supports this case natively: define the constant `WP_MCP_AUTOLOAD` as `false` in the Bedrock config (`config/application.php` on Bedrock/Sage, the project's Bedrock application config on `radicle-app`), and it skips the guard. Prefer this over creating a stub `autoload.php`.

## Default server

| Item | Value |
|---|---|
| Server id | `mcp-adapter-default-server` |
| HTTP route | `/wp-json/mcp/mcp-adapter-default-server` |
| Tools | `mcp-adapter/discover-abilities`, `mcp-adapter/get-ability-info`, `mcp-adapter/execute-ability` (client names `mcp-adapter-discover-abilities`, …) |
| Resources / prompts | abilities with `meta.mcp.public` and `meta.mcp.type` `resource` / `prompt` |
| What is visible | only abilities with `meta.mcp.public => true` |
| HTTP access | logged-in user with `read` by default; filter `mcp_adapter_default_transport_permission_user_capability` to raise it |
| Config filter | `mcp_adapter_default_server_config` |

## Custom server (abilities as direct tools)

```php
add_action('mcp_adapter_init', function ($adapter): void {
    $adapter->create_server(
        'my-site-server',                 // id
        'my-site',                        // REST namespace
        'mcp',                            // REST route → /wp-json/my-site/mcp
        'My site MCP',                    // name
        'Project abilities as tools',     // description
        'v1.0.0',                         // version
        [\WP\MCP\Transport\HttpTransport::class],
        \WP\MCP\Infrastructure\ErrorHandling\ErrorLogMcpErrorHandler::class,
        \WP\MCP\Infrastructure\Observability\NullMcpObservabilityHandler::class,
        ['my-site/list-projects'],        // tools: listed abilities do not need mcp.public
    );
});
```

## STDIO through the runner

```
{{runner.wp}} mcp-adapter list
{{runner.wp}} mcp-adapter serve --server=mcp-adapter-default-server --user=<login>
```

- Always pass `--server=`: without it the command prints "Using server: …" to stdout, which corrupts the JSON-RPC stream.
- `--user=` sets the WordPress user for every call; abilities run with that user's capabilities. Use a dedicated local account with the least role that works.
- Keep PHP notices off stdout for this command (`WP_DEBUG_DISPLAY` false); log them instead.

## Project `.mcp.json`

Split the runner into `command` + `args`. With the Lando default (`{{runner.wp}}` = `lando wp`):

```json
{
  "mcpServers": {
    "wordpress": {
      "command": "lando",
      "args": ["wp", "mcp-adapter", "serve", "--server=mcp-adapter-default-server", "--user=mcp-agent"]
    }
  }
}
```

- Run it from the project root (where `.lando.yml` lives). A project tooling entry (for example a `mcp-serve` command in `.lando.yml`) can wrap the same command; then `args` is just that tooling name.
- No credentials in `.mcp.json`; it is usually committed. The STDIO transport needs none because it runs inside the container as a WP-CLI process.
- Restart the MCP client after changing `.mcp.json` or after registering new abilities.

## HTTP clients

- Endpoint: `https://<site>/wp-json/mcp/mcp-adapter-default-server` (or the custom route).
- Authenticate with an application password of a dedicated user (Users → Profile → Application Passwords, or `{{runner.wp}} user application-password create <user> mcp`). Pass it through the client's secret store or environment, never in a committed file.
- Clients that only speak STDIO can use a local HTTP proxy package; check its current name and version before adding it.
- Behind a CDN or page cache, exclude the MCP route from caching.
