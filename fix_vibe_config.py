import os

config_path = os.path.expanduser('~/.vibe/config.toml')

content = """
active_model = "devstral-2"
vim_keybindings = false
disable_welcome_banner_animation = false
autocopy_to_clipboard = true
file_watcher_for_autocomplete = false
displayed_workdir = ""
context_warnings = false
voice_mode_enabled = false
narrator_enabled = false
active_transcribe_model = "voxtral-realtime"
active_tts_model = "voxtral-tts"
auto_approve = false
enable_telemetry = true
system_prompt_id = "cli"
include_commit_signature = true
include_model_info = true
include_project_context = true
include_prompt_detail = true
enable_update_checks = true
enable_auto_update = true
enable_notifications = true
api_timeout = 720.0
auto_compact_threshold = 200000
tool_paths = []
enabled_tools = []
disabled_tools = []
agent_paths = []
enabled_agents = []
disabled_agents = []
installed_agents = ["lean"]
skill_paths = []
enabled_skills = []
disabled_skills = []

[[providers]]
name = "mistral"
api_base = "https://api.mistral.ai/v1"
api_key_env_var = "MISTRAL_API_KEY"
browser_auth_base_url = "https://console.mistral.ai"
browser_auth_api_base_url = "https://console.mistral.ai/api"
api_style = "openai"
backend = "mistral"
reasoning_field_name = "reasoning_content"

[[providers]]
name = "llamacpp"
api_base = "http://127.0.0.1:8080/v1"
api_style = "openai"
backend = "generic"
reasoning_field_name = "reasoning_content"

[[models]]
name = "mistral-vibe-cli-latest"
provider = "mistral"
alias = "devstral-2"
temperature = 0.2
input_price = 0.4
output_price = 2.0

[[models]]
name = "devstral-small-latest"
provider = "mistral"
alias = "devstral-small"
temperature = 0.2
input_price = 0.1
output_price = 0.3

[[models]]
name = "devstral"
provider = "llamacpp"
alias = "local"
temperature = 0.2

[[transcribe_providers]]
name = "mistral"
api_base = "wss://api.mistral.ai"
api_key_env_var = "MISTRAL_API_KEY"
client = "mistral"

[[transcribe_models]]
name = "voxtral-mini-transcribe-realtime-2602"
provider = "mistral"
alias = "voxtral-realtime"
sample_rate = 16000
encoding = "pcm_s16le"
language = "en"
target_streaming_delay_ms = 500

[[tts_providers]]
name = "mistral"
api_base = "https://api.mistral.ai"
api_key_env_var = "MISTRAL_API_KEY"
client = "mistral"

[[tts_models]]
name = "voxtral-mini-tts-latest"
provider = "mistral"
alias = "voxtral-tts"
voice = "gb_jane_neutral"
# response_format = "wav" # Commenting out to see if it fixes line 1 issues

[project_context]
default_commit_count = 5
timeout_seconds = 2.0

[session_logging]
save_dir = "C:/Users/15anu/.vibe/logs/session"
session_prefix = "session"
enabled = true

[tools.ask_user_question]
permission = "always"

[tools.bash]
permission = "ask"
allowlist = ["cd", "echo", "git diff", "git log", "git status", "tree", "whoami", "dir", "findstr", "more", "type", "ver", "where"]

[tools.grep]
permission = "always"

[tools.read_file]
permission = "always"

[tools.search_replace]
permission = "ask"

[tools.skill]
permission = "ask"

[tools.task]
permission = "ask"

[tools.todo]
permission = "always"

[tools.web_fetch]
permission = "ask"

[tools.web_search]
permission = "ask"

[tools.write_file]
permission = "ask"

# --- MCP SERVERS (Total 15) ---

[[mcp_servers]]
name = "memory"
transport = "stdio"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-memory"]
env = { "MEMORY_FILE_PATH" = "C:/Users/15anu/.vibe/memory.json" }

[[mcp_servers]]
name = "sequential-thinking"
transport = "stdio"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-sequential-thinking"]

[[mcp_servers]]
name = "github"
transport = "stdio"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-github"]

[[mcp_servers]]
name = "exa"
transport = "stdio"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-exa"]

[[mcp_servers]]
name = "playwright"
transport = "stdio"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-playwright"]

[[mcp_servers]]
name = "duckduckgo"
transport = "stdio"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-duckduckgo"]

[[mcp_servers]]
name = "fetch"
transport = "stdio"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-fetch"]

[[mcp_servers]]
name = "filesystem"
transport = "stdio"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "C:/Users/15anu/OneDrive/文档/code/ecomm/Aarya_Clothing"]

[[mcp_servers]]
name = "google-search"
transport = "stdio"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-google-search"]

[[mcp_servers]]
name = "postgres"
transport = "stdio"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-postgres"]

[[mcp_servers]]
name = "sqlite"
transport = "stdio"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-sqlite"]

[[mcp_servers]]
name = "slack"
transport = "stdio"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-slack"]

[[mcp_servers]]
name = "brave-search"
transport = "stdio"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-brave-search"]

[[mcp_servers]]
name = "everything"
transport = "stdio"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-everything"]

[[mcp_servers]]
name = "wikipedia"
transport = "stdio"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-wikipedia"]
"""

with open(config_path, 'w', encoding='utf-8') as f:
    f.write(content.strip())
print("Config successfully updated.")
