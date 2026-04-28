# MCP Server Setup for Aarya Clothing

This document describes the MCP (Model Context Protocol) servers configured for the Aarya Clothing e-commerce project.

## Overview

All MCP servers are installed globally via npm and configured in `kilo.json` for seamless integration with the Kilo AI CLI.

## Installed MCP Servers

### 1. Docker MCP Server (`@hypnosis/docker-mcp-server`) - v1.4.1
**Purpose**: Provides Docker container and image management capabilities for AI assistants.

**Features**:
- Manage Docker containers (start, stop, restart, remove)
- Manage Docker images (build, pull, push, remove)
- Execute commands inside containers
- Query container logs and inspect details
- Docker Compose support
- 15+ Docker operations with CLI aliases

**Installation**:
```bash
npm install -g @hypnosis/docker-mcp-server
```

**Configuration** (in kilo.json):
```json
"docker": {
  "type": "local",
  "command": ["npx", "-y", "@hypnosis/docker-mcp-server"],
  "enabled": true,
  "timeout": 30000,
  "environment": {
    "DOCKER_MCP_AUTO_DISCOVER": "true",
    "DOCKER_MCP_MASK_SECRETS": "true"
  }
}
```

**Usage**:
```bash
# List all containers
docker-mcp-server dlist

# Run a command
docker-mcp-server dcompose-up
```

**Requirements**:
- Node.js >= 18.0.0
- Docker (Docker Desktop or Docker Engine)
- docker-compose

---

### 2. Filesystem MCP Server (`@j0hanz/filesystem-mcp`) - v1.19.1
**Purpose**: Safe and efficient filesystem operations for AI agents - read, write, search, diff, patch, and manage files.

**Features**:
- Read and write files with encoding support
- Recursive directory traversal
- File search with glob patterns
- Grep/regex search within files
- Diff and patch operations
- MD5 checksum generation
- Safe path validation
- Concurrent file operations

**Installation**:
```bash
npm install -g @j0hanz/filesystem-mcp
```

**Configuration** (in kilo.json):
```json
"filesystem": {
  "type": "local",
  "command": ["npx", "-y", "@j0hanz/filesystem-mcp", "--allow-cwd"],
  "enabled": true,
  "timeout": 30000
}
```

**Usage**:
```bash
# Access specific directory
npx @j0hanz/filesystem-mcp@latest /path/to/project

# Allow current working directory
npx @j0hanz/filesystem-mcp@latest --allow-cwd

# Enable HTTP transport
npx @j0hanz/filesystem-mcp@latest --port 3000
```

**Options**:
- `--allow-cwd`: Allow the current working directory as an additional root
- `--port <number>`: Enable HTTP transport on given port

**Requirements**:
- Node.js >= 18.0.0

---

### 3. Git MCP Server (`@cyanheads/git-mcp-server`) - v2.14.2
**Purpose**: Comprehensive Git operations for AI agents - 28+ tools for repository management, commits, branching, merging, and more.

**Features**:
- Repository management (clone, init, status)
- Commit operations (commit, log, diff)
- Branch management (branch, checkout, merge, rebase)
- Remote operations (push, pull, fetch)
- Tag management
- Worktree support
- Stash operations
- Cherry-pick and reset
- Blame and show
- Supports STDIO and Streamable HTTP transports

**Installation**:
```bash
npm install -g @cyanheads/git-mcp-server
```

**Configuration** (in kilo.json):
```json
"git": {
  "type": "local",
  "command": ["npx", "-y", "@cyanheads/git-mcp-server"],
  "enabled": true,
  "timeout": 30000,
  "environment": {
    "MCP_TRANSPORT_TYPE": "stdio",
    "MCP_LOG_LEVEL": "info",
    "GIT_BASE_DIR": "C:\\...\\Aarya_Clothing",
    "LOGS_DIR": "C:\\...\\.logs\\git-mcp-server",
    "GIT_AUTHOR_NAME": "Aarya Clothing Dev",
    "GIT_AUTHOR_EMAIL": "dev@aarya-clothing.com",
    "GIT_SIGN_COMMITS": "false"
  }
}
```

**Environment Variables**:
- `MCP_TRANSPORT_TYPE`: Transport type (`stdio` or `http`) - default: `stdio`
- `MCP_LOG_LEVEL`: Log level (`error`, `warn`, `info`, `debug`) - default: `info`
- `MCP_SESSION_MODE`: HTTP session mode (`stateless`, `stateful`, `auto`) - default: `auto`
- `MCP_RESPONSE_FORMAT`: Response format (`json`, `markdown`, `auto`) - default: `json`
- `MCP_RESPONSE_VERBOSITY`: Detail level (`minimal`, `standard`, `full`) - default: `standard`
- `MCP_HTTP_PORT`: HTTP server port - default: `3015`
- `GIT_BASE_DIR`: Absolute path restricting git operations
- `LOGS_DIR`: Directory for server logs
- `GIT_AUTHOR_NAME`: Git author name
- `GIT_AUTHOR_EMAIL`: Git author email
- `GIT_SIGN_COMMITS`: Enable GPG/SSH signing (`true`/`false`)

**Requirements**:
- Node.js >= 20.0.0 or Bun >= 1.2.0
- Git CLI installed and in PATH

---

### 4. Playwright MCP Server (`@playwright/mcp`) - v0.0.70
**Purpose**: Browser automation and testing capabilities using Playwright framework.

**Features**:
- Automated browser testing
- Page interaction and navigation
- Screenshot capture
- Form filling and submission
- Element selection and manipulation
- Network request interception
- Cross-browser support (Chromium, Firefox, WebKit)

**Installation**:
```bash
npm install -g @playwright/mcp
```

**Configuration** (in kilo.json):
```json
"playwright": {
  "type": "local",
  "command": ["npx", "-y", "@playwright/mcp"],
  "enabled": true,
  "timeout": 30000,
  "environment": {
    "PLAYWRIGHT_BROWSERS_PATH": "0"
  }
}
```

**Options**:
- `--allowed-hosts <hosts...>`: Comma-separated list of allowed hosts (use `*` to disable check)
- `--allowed-origins <origins>`: Semicolon-separated list of trusted origins

**Requirements**:
- Node.js
- Playwright browsers installed (or use `PLAYWRIGHT_BROWSERS_PATH=0` for on-demand download)

---

### 5. Fetch MCP Server (`@mokei/mcp-fetch`) - v0.6.0
**Purpose**: HTTP fetch operations for AI agents - make HTTP requests and retrieve web content.

**Features**:
- HTTP GET, POST, PUT, DELETE, PATCH requests
- Custom headers support
- Request body support
- Response handling
- Timeout configuration

**Installation**:
```bash
npm install -g @mokei/mcp-fetch
```

**Configuration** (in kilo.json):
```json
"fetch": {
  "type": "local",
  "command": ["npx", "-y", "@mokei/mcp-fetch"],
  "enabled": true,
  "timeout": 30000
}
```

**Requirements**:
- Node.js

---

## Installation Summary

All MCP servers were installed with a single command:

```bash
npm install -g @hypnosis/docker-mcp-server @j0hanz/filesystem-mcp @cyanheads/git-mcp-server @playwright/mcp @mokei/mcp-fetch
```

## Configuration File Structure

The `kilo.json` file configures all MCP servers with:
- **type**: `local` (all are local stdio-based servers)
- **command**: Array with `npx` and package name
- **enabled**: True for all servers
- **timeout**: 30000ms (30 seconds) for all operations
- **environment**: Server-specific environment variables

## Verification

### Check Installation
```bash
# List globally installed MCP packages
npm list -g --depth=0 | grep -E "(hypnosis|j0hanz|cyanheads|playwright|mokei)"
```

### Test Each Server
```bash
# Docker MCP Server
npx -y @hypnosis/docker-mcp-server --version

# Filesystem MCP Server
npx -y @j0hanz/filesystem-mcp --version

# Git MCP Server
npx -y @cyanheads/git-mcp-server --version

# Playwright MCP Server
npx -y @playwright/mcp --help

# Fetch MCP Server
npx -y @mokei/mcp-fetch --help
```

## Usage with Kilo CLI

Once configured, the Kilo AI CLI will automatically load and connect to all these MCP servers, providing AI agents with:

1. **Docker operations**: Manage containers and images
2. **Filesystem access**: Read/write/search project files
3. **Git operations**: Version control and repository management
4. **Browser automation**: End-to-end testing and scraping
5. **HTTP requests**: Fetch external APIs and resources

## Troubleshooting

### Server Not Starting
- Verify Node.js version meets requirements
- Check that package is installed globally: `npm list -g <package-name>`
- Review Kilo CLI logs for connection errors

### Permission Denied
- Ensure Docker daemon is running (for Docker MCP)
- Check file/directory permissions (for Filesystem MCP)
- Verify Git is installed and in PATH (for Git MCP)

### Timeout Issues
- Increase `timeout` value in kilo.json
- Check server is responding: run command manually
- Verify no firewall blocking connections

## Additional Resources

- [Kilo CLI Configuration Reference](https://github.com/kilo-org/kilo)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io)
- [Docker MCP Server](https://github.com/hypnosis/docker-mcp-server)
- [Filesystem MCP Server](https://github.com/j0hanz/filesystem-mcp)
- [Git MCP Server](https://github.com/cyanheads/git-mcp-server)
- [Playwright MCP Server](https://github.com/microsoft/playwright-mcp)
- [Fetch MCP Server](https://github.com/mokei/mcp-fetch)
