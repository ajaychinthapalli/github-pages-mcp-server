# Example MCP Server Configuration

This file demonstrates how to configure the GitHub Pages MCP Server in various MCP clients.

## Claude Desktop Configuration

Add this to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "github-pages": {
      "command": "node",
      "args": ["/absolute/path/to/github-pages-mcp-server/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_github_personal_access_token"
      }
    }
  }
}
```

## Getting a GitHub Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a descriptive name (e.g., "GitHub Pages MCP Server")
4. Select the following scopes:
   - `repo` (Full control of private repositories)
   - `public_repo` (Access public repositories)
   - `workflow` (Update GitHub Action workflows)
5. Click "Generate token" and copy the token
6. Add it to your MCP configuration as shown above

## Example Usage

Once configured, you can use the tools in your MCP client:

### Enable GitHub Pages
```
Please enable GitHub Pages for my repository "username/my-site" using the main branch and /docs path
```

### Get Pages Info
```
What's the current GitHub Pages configuration for username/my-site?
```

### Deploy Files
```
Deploy an index.html file to GitHub Pages for username/my-site on the gh-pages branch
```

### Update Configuration
```
Update the GitHub Pages config for username/my-site to use the main branch instead
```

### Disable GitHub Pages
```
Disable GitHub Pages for username/my-site
```
