# AI Tool MCP Configurations

This directory contains MCP (Model Context Protocol) server configurations for various AI tools and assistants.

## Overview

All configurations include the same 6 MCP servers for consistent tool access across different AI platforms:

1. **Exa** - Web search and research (remote)
2. **Docker** - Container and image management
3. **Filesystem** - File operations with search/diff/patch
4. **Git** - Version control operations (28+ tools)
5. **Playwright** - Browser automation and testing
6. **Fetch** - HTTP request capabilities

## Configuration Files

### 1. `kilo.json` (Kilo CLI)
Primary configuration for the Kilo AI CLI tool.

**Location**: Project root  
**Used by**: Kilo CLI (`kilo` command)

**Features**:
- Follows Kilo CLI configuration format
- Includes MCP server definitions with timeouts and environment variables
- References instruction files (AGENTS.md, GEMINI.md)
- Sets default agent and model preferences

### 2. `claude_desktop_config.json` (Claude Desktop)
Configuration for Anthropic Claude Desktop application.

**Location**: Project root (copy to Claude config directory)  
**Used by**: Claude Desktop

**Installation**:
```bash
# macOS
cp claude_desktop_config.json ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Windows
copy claude_desktop_config.json %APPDATA%\Claude\claude_desktop_config.json
```

**Note**: Claude Desktop uses `stdio` type for local MCP servers.

### 3. `gemini_config.json` (Google Gemini)
Configuration for Google Gemini with MCP support.

**Location**: Project root  
**Used by**: Gemini API/CLI tools

**Features**:
- JSON array format for MCP servers
- Compatible with Gemini's MCP integration

### 4. `vibe_config.json` (Vibe Coding Tools)
Configuration for vibe coding assistants and IDEs.

**Location**: Project root  
**Used by**: Vibe, Cursor, Windsurf, and similar tools

**Features**:
- Standard MCP server configuration format
- Compatible with most AI coding assistants

### 5. `antigravity_config.json` (AntiGravity)
Configuration for AntiGravity AI tools.

**Location**: Project root  
**Used by**: AntiGravity platform

**Features**:
- Standard MCP server configuration
- Same tool set as other configurations

## MCP Servers Details

### Exa (Remote)
```json
{
  "type": "remote",
  "url": "https://mcp.exa.ai/mcp?exaApiKey=..."
}
```
- Web search and research capabilities
- Company and people research
- Content crawling
- Deep research mode

### Docker (Local)
```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@hypnosis/docker-mcp-server"]
}
```
- 15+ Docker operations
- Container and image management
- Docker Compose support
- Auto-discovery enabled

### Filesystem (Local)
```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@j0hanz/filesystem-mcp", "--allow-cwd"]
}
```
- File read/write/search
- Diff and patch operations
- Glob pattern matching
- Concurrent operations

### Git (Local)
```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@cyanheads/git-mcp-server"]
}
```
- 28+ Git operations
- Repository management
- Branch and merge operations
- Remote operations

### Playwright (Local)
```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@playwright/mcp"]
}
```
- Browser automation
- Cross-browser testing
- Screenshot capture
- Form interaction

### Fetch (Local)
```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@mokei/mcp-fetch"]
}
```
- HTTP requests (GET, POST, PUT, DELETE, PATCH)
- Custom headers
- Request/response handling

## Installation Requirements

### Global NPM Packages
```bash
npm install -g @hypnosis/docker-mcp-server @j0hanz/filesystem-mcp @cyanheads/git-mcp-server @playwright/mcp @mokei/mcp-fetch
```

### System Requirements
- Node.js >= 20.0.0 (for git-mcp-server)
- Node.js >= 18.0.0 (for other servers)
- Docker (for Docker MCP)
- Git CLI (for Git MCP)
- Playwright browsers (optional, auto-download)

## Usage Examples

### Claude Desktop
1. Copy config: `cp claude_desktop_config.json ~/Library/Application\ Support/Claude/claude_desktop_config.json`
2. Restart Claude Desktop
3. AI agents can now use Docker, Git, filesystem, and other tools

### Kilo CLI
1. Config is already in `kilo.json`
2. Start Kilo: `kilo`
3. All MCP servers auto-load

### Gemini
1. Import `gemini_config.json` in Gemini settings
2. MCP servers connect automatically

### Vibe / Cursor / Windsurf
1. Import `vibe_config.json`
2. Tools available in AI chat

## Environment Variables

Each MCP server uses specific environment variables:

| Server | Key Variables |
|--------|---------------|
| Docker | `DOCKER_MCP_AUTO_DISCOVER`, `DOCKER_MCP_MASK_SECRETS` |
| Filesystem | `PWD` (working directory) |
| Git | `GIT_BASE_DIR`, `LOGS_DIR`, `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL` |
| Playwright | `PLAYWRIGHT_BROWSERS_PATH` |
| Fetch | (none required) |
| Exa | API key in URL |

## Troubleshooting

### MCP Server Not Starting
1. Verify global installation: `npm list -g --depth=0`
2. Check Node.js version: `node --version`
3. Test server manually: `npx -y <package-name> --version`

### Permission Denied
- Docker: Ensure Docker daemon is running
- Filesystem: Check directory permissions
- Git: Verify Git is in PATH

### Connection Timeout
- Increase `timeout` value in config (default: 30000ms)
- Check firewall settings
- Verify server responds to manual start

## Security Notes

- Docker secrets are masked in logs
- Git operations restricted to project directory
- Filesystem access limited to allowed directories
- Exa API key is embedded in URL (use environment variables in production)
- No sensitive data in commit messages

## Adding New MCP Servers

1. Install globally: `npm install -g <package>`
2. Add to all config files
3. Test with each AI tool
4. Update documentation

## Resources

- [Kilo CLI Config](kilO_JSON_SCHEMA.md)
- [MCP Protocol](https://modelcontextprotocol.io)
- [Exa MCP](https://docs.exa.ai/reference/exa-mcp)
- [Docker MCP Server](https://github.com/hypnosis/docker-mcp-server)
- [Filesystem MCP Server](https://github.com/j0hanz/filesystem-mcp)
- [Git MCP Server](https://github.com/cyanheads/git-mcp-server)
- [Playwright MCP](https://github.com/microsoft/playwright-mcp)
- [Fetch MCP Server](https://github.com/mokei/mcp-fetch)
