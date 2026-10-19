/**
 * Where a language in the folder stands. `ready`: an enabled plugin's server covers it and its
 * command is on PATH. `no-server`: the plugin is on but the command isn't on PATH. `disabled`: the
 * plugin is installed and switched off here. `available`: a marketplace you added has a plugin for
 * it that isn't installed. `mcp`: no plugin covers it, but an MCP server's language server does,
 * through that server's own tools. `none`: nothing covers it.
 */
export type Status = 'ready' | 'no-server' | 'disabled' | 'available' | 'mcp' | 'none'

/** One language found in the folder and how its LSP is set up. */
export type Row = {
  lang: string
  name: string
  files: number
  /** A file of the language, relative to the folder, that the Test button asks the server about. */
  sample: string
  status: Status
  /** The plugin as `name@marketplace`. */
  plugin?: string
  /** The MCP server whose language server covers it, for `mcp`. */
  mcp?: string
  server?: string
  command?: string
  /** Where the command was found on PATH. */
  binary?: string
  /** The shell line that fixes it. */
  fix?: string
  notes: string[]
}

export type Report = {
  at: number
  cwd: string
  folder: string
  files: number
  /** `git` lists tracked and unignored files; `walk` reads the folder and skips build output. */
  via: 'git' | 'walk'
  /** True when the walk hit its limit before it read the whole folder. */
  isCapped: boolean
  rows: Row[]
  /** File types that look like code with no server and no entry in the language table, most files first. */
  unplaced: [string, number][]
}

/** The answer the last Test press got from a language's server. */
export type Probe = { state: 'running' | 'ok' | 'failed'; text: string }

declare module 'claude-code' {
  interface PluginState {
    'lsp-status': {
      report: Report | null
      isScanning: boolean
      probes: Record<string, Probe>
    }
  }
}
