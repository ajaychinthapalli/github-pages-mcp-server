# GitHub Pages MCP Server

A Model Context Protocol (MCP) server for managing GitHub Pages deployments. This server provides tools to enable, configure, deploy, and manage GitHub Pages sites through the MCP protocol.

## Features

This MCP server provides the following tools:

- **enable_github_pages** - Enable GitHub Pages for a repository with custom source and build settings
- **get_github_pages_info** - Get current GitHub Pages configuration and deployment status
- **deploy_to_github_pages** - Deploy files directly to GitHub Pages branch
- **disable_github_pages** - Disable GitHub Pages for a repository
- **update_github_pages_config** - Update GitHub Pages configuration (source, build type, custom domain)

## Installation

```bash
npm install
npm run build
```

## Configuration

The server requires a GitHub Personal Access Token with appropriate permissions to manage GitHub Pages.

### Required GitHub Token Permissions

Your GitHub token needs the following scopes:
- `repo` (Full control of private repositories)
- `public_repo` (Access public repositories)
- `workflow` (Update GitHub Action workflows, if using workflow build type)

### Setting the Token

Set the `GITHUB_TOKEN` environment variable:

```bash
export GITHUB_TOKEN=ghp_your_token_here
```

## Usage

### Running the Server

```bash
# Build and run
npm run build
node dist/index.js
```

### MCP Client Configuration

Add to your MCP client configuration (e.g., Claude Desktop config):

```json
{
  "mcpServers": {
    "github-pages": {
      "command": "node",
      "args": ["/path/to/github-pages-mcp-server/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "your_github_token_here"
      }
    }
  }
}
```

## Tools Reference

### enable_github_pages

Enable GitHub Pages for a repository.

**Parameters:**
- `owner` (string, required): Repository owner (username or organization)
- `repo` (string, required): Repository name
- `source` (object, required):
  - `branch` (string, required): Branch to deploy from (e.g., 'main', 'gh-pages')
  - `path` (string, optional): Path to deploy from ('/' or '/docs')
- `build_type` (string, optional): Build type - 'legacy' for Jekyll or 'workflow' for GitHub Actions

**Example:**
```json
{
  "owner": "username",
  "repo": "my-website",
  "source": {
    "branch": "main",
    "path": "/docs"
  },
  "build_type": "legacy"
}
```

### get_github_pages_info

Get the current GitHub Pages configuration and status.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name

**Example:**
```json
{
  "owner": "username",
  "repo": "my-website"
}
```

### deploy_to_github_pages

Deploy files to a GitHub Pages branch by creating commits.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `branch` (string, required): Branch to deploy to (must match GitHub Pages source branch)
- `message` (string, optional): Commit message
- `files` (array, optional): Array of files to deploy
  - `path` (string, required): File path in repository
  - `content` (string, required): File content
  - `encoding` (string, optional): 'utf-8' or 'base64'

**Example:**
```json
{
  "owner": "username",
  "repo": "my-website",
  "branch": "gh-pages",
  "message": "Update homepage",
  "files": [
    {
      "path": "index.html",
      "content": "<html><body>Hello World</body></html>",
      "encoding": "utf-8"
    }
  ]
}
```

### disable_github_pages

Disable GitHub Pages for a repository.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name

**Example:**
```json
{
  "owner": "username",
  "repo": "my-website"
}
```

### update_github_pages_config

Update GitHub Pages configuration settings.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `source` (object, optional):
  - `branch` (string, required): Branch to deploy from
  - `path` (string, optional): Path to deploy from
- `build_type` (string, optional): 'legacy' or 'workflow'
- `cname` (string, optional): Custom domain name

**Example:**
```json
{
  "owner": "username",
  "repo": "my-website",
  "source": {
    "branch": "main",
    "path": "/"
  },
  "cname": "www.example.com"
}
```

## Development

### Building

```bash
npm run build
```

### Watching for Changes

```bash
npm run watch
```

### Linting

```bash
npm run lint
```

## Requirements

- Node.js >= 18.0.0
- GitHub Personal Access Token with repo permissions

## License

MIT