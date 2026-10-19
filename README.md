# LSP status

A Claude Code mod that checks whether the code in the session's folder has a language server Claude can use, and shows what's missing.

With a language server, Claude answers "where is this defined" or "what calls this" with one `goToDefinition` or `findReferences` call that returns file paths and line numbers. Without one it greps the repository and reads files until it finds the same thing, and everything it reads stays in the context for the rest of the session. Claude Code gets its language servers from plugins, so a project can easily hold a language that no installed plugin covers, or a plugin whose server program was never installed. Claude Code doesn't tell you when that happens. This mod does.

## What it shows

A short item sits in the band above the prompt: `LSP ready` in green when every language in the folder has a server, or a count like `LSP 2/3`. The count is red when a plugin is on but its server program isn't on PATH, and yellow when a plugin is missing or switched off. The same count goes to the status line. The item's Open button opens the LSP pane. `/lsp-status` opens it too and prints the report as text, which the model also reads.

The pane has one card per language in the folder, each in one of these states:

- ready: an enabled plugin covers it and its server is on PATH
- server not on PATH: the plugin is on, the program it starts is missing
- plugin off: the plugin is installed and disabled for this folder
- plugin not installed: a marketplace you added has a plugin for it
- MCP only: no plugin covers it, but an MCP server's language server does

Cards with a problem come first and carry the line that fixes it, such as `claude plugin install rust-analyzer-lsp@claude-plugins-official` or `npm install --global pyright`. Ask Claude to fix puts those lines in the prompt box for you to send or edit. Ready cards have a Test button that runs the LSP tool's `documentSymbol` on a file of that language, the same call the model makes, and shows the answer or the error. Two lines at the bottom name the languages nothing covers and the file types the mod doesn't recognize.

Some servers need a project file before they have anything to load. A C# folder with no `.sln`, `.slnx` or `.csproj` under it gets a warning, because csharp-ls only searches down from the folder the session starts in. Go and Rust get one when no `go.mod` or `Cargo.toml` is in the folder or any folder above it.

## Where it looks

The file list comes from `git ls-files --cached --others --exclude-standard`, so ignored build output doesn't count. Outside a repository the mod walks the folder instead, skipping dot folders, `node_modules`, `bin`, `obj`, `dist`, `build` and similar, and stops after 3,000 folders.

Language servers come from every place Claude Code loads one, plus MCP servers:

- the plugins in each marketplace you added, from the servers their marketplace entries declare
- installed plugins whose entries list no servers, read from the plugin's own `plugin.json` or `.lsp.json`
- plugin folders named in `CLAUDE_CODE_PLUGIN_DIRS`
- plugins under `~/.claude/skills` and the project's `.claude/skills`
- MCP servers with an `lsp_status` tool that answers `{ "servers": [{ "id": "...", "extensions": [".ext"] }] }`

For the last one the mod asks every connected server that has the tool, plus any server in your MCP config with "lsp" in its name. It calls `lsp_status` and no other tool.

A file type counts as a language when the mod's own table names it or when any of those servers declares it. Data formats such as JSON and YAML show only once some server covers them. Any other type that isn't on the mod's list of non-code types (images, archives, lock files, engine assets and so on) goes in the unknown list.

A plugin counts as installed when Claude Code's install record has a user install, or a project or local install for this folder or one above it. It counts as on when the merged settings set it to `true` under `enabledPlugins`. A plugin under a skills folder counts as on unless `enabledPlugins` sets it to `false`. Server commands are looked up with `where` on Windows and `which` elsewhere.

The mod scans when the session starts, when you press Rescan or run `/lsp-status`, and after a turn once the last scan is a minute old or the session has moved to another folder.

## Limits

The pane reads plugin files and settings, not the running session. A plugin installed or enabled mid-session shows as ready before the LSP tool has loaded its server, so restart the session after a fix and press Test.

MCP-only coverage is read-only, and the model reaches it through that MCP server's own tools, not the LSP tool.

The band shows one drawing. Another mod that draws its own band line without passing on what `next(e)` returns hides this item whenever it runs first. The fix in that mod is to call `next(e)` and put the result at the end of its own line.

The function hooks API is early access and changes between releases. The mod was built against Claude Code 2.1.299 and has been used in the desktop app on Windows 11. macOS and Linux are untested.

## Install

At the prompt of a terminal session:

```
/plugin install lsp-status --marketplace shin2344234/claude-lsp-status
```

Answer `y` to add the marketplace, then pick a scope. From a shell:

```bash
claude plugin install lsp-status --marketplace shin2344234/claude-lsp-status
```

In the desktop app, where `/plugin` doesn't run: click + next to the prompt box, then Plugins, Add marketplace with `shin2344234/claude-lsp-status`, then Add plugin.

## Development

`hooks/scan.ts` holds the language table, the server matching, the row states and the text the command and the fix button produce. `hooks/register.tsx` reads the files, plugins, settings, MCP servers and PATH, and draws the band item and the pane. `types/index.d.ts` declares the values the mod keeps in session state.

To run a clone, name its folder in `CLAUDE_CODE_PLUGIN_DIRS`, either in your shell or in the `env` block of `~/.claude/settings.json`, which the desktop app also reads. Add `CLAUDE_CODE_PLUGIN_DIR_WATCH=1` there to reload the mod when you save a file.

```bash
claude plugin validate .
```

```bash
claude plugin test .
```

`scan.test.ts` covers the matching, each state, MCP-only coverage, file types that only a server declares, and the unknown list. `pane.test.tsx` runs the command against a made-up Windows machine and draws the pane and the band on the terminal and desktop surfaces. It covers an MCP server with `lsp_status`, plugins from `CLAUDE_CODE_PLUGIN_DIRS` and the skills folder, Test against a server that answers and one that fails, and the band item on its own, after another mod's line, and under a survey.

## License

MIT
