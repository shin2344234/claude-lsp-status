import type { Row, Status } from '../types'

export type Lang = {
  id: string
  name: string
  exts: string[]
  /** Whole file names that are the language, lowercased, such as `dockerfile`. */
  names?: string[]
  /**
   * A data or markup format. It shows only when some server covers it; with none, its files
   * are neither a missing language nor an unknown file type.
   */
  isData?: true
  /** Community plugins for the language whose marketplace entry lists no servers, so their extensions can't be read. */
  plugins?: string[]
  /**
   * Project files the server needs to load the code. `looksUp` says a file in a folder above the
   * session's counts, as it does for gopls; csharp-ls only searches down from the folder it starts in.
   */
  project?: { files: string[]; looksUp: boolean; missing: string }
}

/**
 * Names and project checks for languages. Which file types count comes from the servers too: an
 * extension any server declares is a language here even when this table lacks it.
 */
export const LANGS: Lang[] = [
  {
    id: 'csharp',
    name: 'C#',
    exts: ['.cs', '.csx'],
    plugins: ['csharp-roslyn-lsp', 'csharp-lsp-roslyn'],
    project: {
      files: ['*.sln', '*.slnx', '*.csproj'],
      looksUp: false,
      missing: 'No .sln or .csproj under this folder, so csharp-ls has no project to load. Start the session in the folder that holds one.',
    },
  },
  { id: 'ts', name: 'TypeScript / JavaScript', exts: ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'] },
  { id: 'python', name: 'Python', exts: ['.py', '.pyi'], plugins: ['ty-python-lsp'] },
  {
    id: 'go',
    name: 'Go',
    exts: ['.go'],
    project: { files: ['go.mod', 'go.work'], looksUp: true, missing: 'No go.mod in this folder or above it, so gopls runs without a module.' },
  },
  { id: 'cpp', name: 'C / C++', exts: ['.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.hxx', '.hh'] },
  { id: 'objc', name: 'Objective-C', exts: ['.m', '.mm'] },
  { id: 'lua', name: 'Lua', exts: ['.lua'] },
  {
    id: 'rust',
    name: 'Rust',
    exts: ['.rs'],
    project: { files: ['Cargo.toml'], looksUp: true, missing: 'No Cargo.toml in this folder or above it, so rust-analyzer has no crate to load.' },
  },
  { id: 'java', name: 'Java', exts: ['.java'] },
  { id: 'kotlin', name: 'Kotlin', exts: ['.kt', '.kts'], plugins: ['kotlin-lsp'] },
  { id: 'groovy', name: 'Groovy', exts: ['.groovy', '.gradle'] },
  { id: 'scala', name: 'Scala', exts: ['.scala', '.sc'] },
  { id: 'php', name: 'PHP', exts: ['.php'], plugins: ['php-lsp-claude-code-plugin'] },
  { id: 'ruby', name: 'Ruby', exts: ['.rb', '.rake', '.gemspec', '.ru', '.erb'] },
  { id: 'swift', name: 'Swift', exts: ['.swift'], plugins: ['swift-lsp'] },
  { id: 'dart', name: 'Dart', exts: ['.dart'] },
  { id: 'gdscript', name: 'GDScript', exts: ['.gd'], plugins: ['godot-lsp-bridge'] },
  { id: 'vue', name: 'Vue', exts: ['.vue'], plugins: ['vue-lsp'] },
  { id: 'svelte', name: 'Svelte', exts: ['.svelte'] },
  { id: 'astro', name: 'Astro', exts: ['.astro'] },
  { id: 'html', name: 'HTML', exts: ['.html', '.htm'] },
  { id: 'css', name: 'CSS', exts: ['.css', '.scss', '.sass', '.less'] },
  { id: 'terraform', name: 'Terraform', exts: ['.tf', '.tfvars'], plugins: ['terraform-lsp'] },
  { id: 'zig', name: 'Zig', exts: ['.zig'], plugins: ['zig-lsp'] },
  { id: 'elixir', name: 'Elixir', exts: ['.ex', '.exs'], plugins: ['elixirls-lsp', 'elixir-expert-lsp'] },
  { id: 'erlang', name: 'Erlang', exts: ['.erl', '.hrl'] },
  { id: 'gleam', name: 'Gleam', exts: ['.gleam'] },
  { id: 'julia', name: 'Julia', exts: ['.jl'], plugins: ['julia-lsp'] },
  { id: 'clojure', name: 'Clojure', exts: ['.clj', '.cljs', '.cljc'], plugins: ['clojure-lsp'] },
  { id: 'lisp', name: 'Lisp / Scheme', exts: ['.lisp', '.el', '.scm', '.rkt'] },
  { id: 'solidity', name: 'Solidity', exts: ['.sol'], plugins: ['solidity-lsp'] },
  { id: 'vb', name: 'VB.NET', exts: ['.vb'], plugins: ['vbnet-lsp-claude-plugin'] },
  { id: 'fsharp', name: 'F#', exts: ['.fs', '.fsx', '.fsi'] },
  { id: 'liquid', name: 'Liquid', exts: ['.liquid'], plugins: ['liquid-lsp'] },
  { id: 'metal', name: 'Metal', exts: ['.metal'], plugins: ['metal-lsp'] },
  { id: 'haskell', name: 'Haskell', exts: ['.hs'] },
  { id: 'ocaml', name: 'OCaml', exts: ['.ml', '.mli'] },
  { id: 'elm', name: 'Elm', exts: ['.elm'] },
  { id: 'nim', name: 'Nim', exts: ['.nim'] },
  { id: 'crystal', name: 'Crystal', exts: ['.cr'] },
  { id: 'haxe', name: 'Haxe', exts: ['.hx'] },
  { id: 'odin', name: 'Odin', exts: ['.odin'] },
  { id: 'nix', name: 'Nix', exts: ['.nix'] },
  { id: 'fortran', name: 'Fortran', exts: ['.f90', '.f95', '.f03', '.f08'] },
  { id: 'cuda', name: 'CUDA', exts: ['.cu', '.cuh'] },
  { id: 'perl', name: 'Perl', exts: ['.pl', '.pm'] },
  { id: 'r', name: 'R', exts: ['.r'] },
  { id: 'tcl', name: 'Tcl', exts: ['.tcl'] },
  { id: 'powershell', name: 'PowerShell', exts: ['.ps1', '.psm1', '.psd1'] },
  { id: 'shell', name: 'Shell', exts: ['.sh', '.bash', '.zsh', '.fish'] },
  { id: 'batch', name: 'Batch', exts: ['.bat', '.cmd'] },
  { id: 'shader', name: 'HLSL / GLSL', exts: ['.hlsl', '.hlsli', '.glsl', '.wgsl', '.vert', '.frag'] },
  { id: 'sql', name: 'SQL', exts: ['.sql'] },
  { id: 'graphql', name: 'GraphQL', exts: ['.graphql', '.gql'] },
  { id: 'protobuf', name: 'Protobuf', exts: ['.proto'] },
  { id: 'qml', name: 'QML', exts: ['.qml'] },
  { id: 'openscad', name: 'OpenSCAD', exts: ['.scad'] },
  { id: 'cmake', name: 'CMake', exts: ['.cmake'], names: ['cmakelists.txt'] },
  { id: 'dockerfile', name: 'Dockerfile', exts: ['.dockerfile'], names: ['dockerfile'] },
  { id: 'json', name: 'JSON', exts: ['.json', '.jsonc'], isData: true },
  { id: 'yaml', name: 'YAML', exts: ['.yaml', '.yml'], isData: true },
  { id: 'toml', name: 'TOML', exts: ['.toml'], isData: true },
  { id: 'xml', name: 'XML', exts: ['.xml', '.xaml', '.xsd', '.xsl', '.csproj', '.props', '.targets', '.svg'], isData: true },
  { id: 'markdown', name: 'Markdown', exts: ['.md', '.markdown'], isData: true },
]

const LANG_BY_ID = new Map(LANGS.map(l => [l.id, l]))

/**
 * Extensions that are never code: documents, media, archives, build output, lock files and
 * engine assets. Anything else no server or table entry places is listed as an unknown type.
 */
const NOT_CODE = new Set(
  (
    '.txt .rst .adoc .pdf .doc .docx .rtf .log .csv .tsv .xls .xlsx .ppt .pptx ' +
    '.png .jpg .jpeg .gif .bmp .ico .icns .webp .tga .psd .dds .exr .hdr .tif .tiff .avif .heic ' +
    '.wav .mp3 .ogg .flac .aac .m4a .mp4 .mov .webm .avi .mkv ' +
    '.ttf .otf .woff .woff2 .eot ' +
    '.zip .7z .rar .gz .tar .tgz .bz2 .xz .zst .pak .cab .msi .dmg .deb .rpm .apk .aab .ipa .vsix .nupkg ' +
    '.exe .dll .so .dylib .a .lib .o .obj .pdb .ilk .exp .bin .dat .class .jar .war .wasm .pyc .pyo .node ' +
    '.lock .lockfile .sum .map .snap .patch .diff .orig .rej .bak .old .tmp .swp .pid .out .cache .db .sqlite .sqlite3 .mdb ' +
    '.example .sample .template .tmpl .dist .service .socket .timer ' +
    '.ini .cfg .conf .env .properties .plist .reg .manifest .resx .settings .user .filters .sln .slnx .vcxproj .pbxproj ' +
    '.editorconfig .gitignore .gitattributes .gitmodules .gitkeep .npmrc .nvmrc .prettierrc .eslintrc .browserslistrc .dockerignore ' +
    '.pem .crt .cer .key .pfx .p12 .keystore .jks .gpg .asc .sig ' +
    '.meta .asset .prefab .unity .mat .anim .controller .physicmaterial .shadergraph .import .uid .tscn .tres .godot .res ' +
    '.fbx .blend .gltf .glb .stl .3mf .ply .usd .usdz .dae .3ds .max .ma .mb .vox ' +
    '.ds_store .lnk .url .torrent .iso .img .vhd .vmdk .xcf .kra .aseprite .ase .spine .atlas'
  ).split(' '),
)

/** A language server a plugin declares or an MCP server reports, and where it stands for this folder. */
export type Server = {
  /** `name@marketplace` for a plugin; the MCP server's name for an MCP server. */
  plugin: string
  name: string
  /** The program a plugin's server runs; empty for an MCP server, which runs its own. */
  command: string
  /** Extensions as `.ext`, and whole file names such as `dockerfile`, lowercased. */
  exts: string[]
  /** The server's own language id for each extension, used for file types the table lacks. */
  langs: Record<string, string>
  isInstalled: boolean
  isEnabled: boolean
  isOfficial: boolean
  isMcp: boolean
}

type Declared = Pick<Server, 'name' | 'command' | 'exts' | 'langs'>

/** The `lspServers` block of a plugin entry or manifest, read into servers. Anything else reads as none. */
export function serversOf(block: unknown): Declared[] {
  if (!block || typeof block !== 'object' || Array.isArray(block)) return []
  return Object.entries(block as Record<string, unknown>).flatMap(([name, v]) => {
    const s = v as { command?: unknown; extensionToLanguage?: unknown }
    if (typeof s?.command !== 'string' || !s.extensionToLanguage || typeof s.extensionToLanguage !== 'object') return []
    const map = Object.entries(s.extensionToLanguage as Record<string, unknown>).map(([e, l]) => [e.toLowerCase(), String(l)] as const)
    return [{ name, command: s.command, exts: map.map(([e]) => e), langs: Object.fromEntries(map) }]
  })
}

/**
 * The servers in an MCP server's `lsp_status` answer, `{ servers: [{ id, extensions }] }`. An id
 * such as `local-css` names its language after the first dash. Any other shape reads as none.
 */
export function mcpServersOf(server: string, answer: unknown): Server[] {
  const list = (answer as { servers?: unknown } | null)?.servers
  if (!Array.isArray(list)) return []
  return list.flatMap(item => {
    const { id, extensions } = (item ?? {}) as { id?: unknown; extensions?: unknown }
    if (typeof id !== 'string' || !Array.isArray(extensions)) return []
    const exts = extensions.filter((x): x is string => typeof x === 'string').map(x => x.toLowerCase())
    const lang = id.includes('-') ? id.slice(id.indexOf('-') + 1) : id
    return [
      {
        plugin: server,
        name: id,
        command: '',
        exts,
        langs: Object.fromEntries(exts.map(e => [e, lang])),
        isInstalled: true,
        isEnabled: true,
        isOfficial: false,
        isMcp: true,
      },
    ]
  })
}

export const baseName = (path: string) => path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)

export function extOf(path: string): string {
  const name = baseName(path)
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot).toLowerCase() : ''
}

/** Whether a file name fits a pattern such as `*.sln` or `go.mod`, ignoring case. */
export function fits(name: string, pattern: string): boolean {
  const n = name.toLowerCase()
  const p = pattern.toLowerCase()
  return p.startsWith('*') ? n.endsWith(p.slice(1)) : n === p
}

const title = (id: string) => id.charAt(0).toUpperCase() + id.slice(1)

export type Tally = { name: string; files: number; exts: Map<string, number>; sample: string }

/**
 * Files per language, with the least nested file of each kept as its sample, and the file types
 * that look like code but that neither the table nor any server places.
 */
export function tally(files: string[], servers: Server[] = []) {
  const byKey = new Map<string, { id: string; name: string }>()
  for (const l of LANGS) for (const k of [...l.exts, ...(l.names ?? [])]) byKey.set(k, l)
  for (const s of servers)
    for (const k of s.exts)
      if (!byKey.has(k)) {
        const id = s.langs[k] ?? k.replace(/^\./, '')
        byKey.set(k, LANG_BY_ID.get(id) ?? { id, name: title(id) })
      }
  const names = new Set([...byKey.keys()].filter(k => !k.startsWith('.')))

  const langs = new Map<string, Tally>()
  const unplaced = new Map<string, number>()
  const depth = (p: string) => p.split(/[\\/]/).length
  for (const f of files) {
    const base = baseName(f).toLowerCase()
    const key = names.has(base) ? base : extOf(f)
    const lang = byKey.get(key)
    if (!lang) {
      if (/^\.[a-z][a-z0-9_+-]{0,9}$/.test(key) && !NOT_CODE.has(key)) unplaced.set(key, (unplaced.get(key) ?? 0) + 1)
      continue
    }
    const t = langs.get(lang.id) ?? { name: lang.name, files: 0, exts: new Map(), sample: f }
    t.files++
    t.exts.set(key, (t.exts.get(key) ?? 0) + 1)
    if (depth(f) < depth(t.sample)) t.sample = f
    langs.set(lang.id, t)
  }
  return { langs, unplaced }
}

/** The unknown file types, most files first, ten at most. */
export function unplaced(files: string[], servers: Server[]): [string, number][] {
  return [...tally(files, servers).unplaced].sort((a, b) => b[1] - a[1]).slice(0, 10)
}

/**
 * The server that best covers a language's files: one that is on beats one that is only
 * installed, which beats one that isn't installed; then the one taking the most of the files;
 * then the official marketplace's.
 */
export function pick(exts: Map<string, number>, servers: Server[]): Server | undefined {
  const rank = (s: Server) => (s.isInstalled && s.isEnabled ? 0 : s.isInstalled ? 1 : 2)
  const covers = (s: Server) => [...exts].reduce((n, [e, c]) => n + (s.exts.includes(e) ? c : 0), 0)
  return servers
    .filter(s => covers(s) > 0)
    .sort((a, b) => rank(a) - rank(b) || covers(b) - covers(a) || Number(b.isOfficial) - Number(a.isOfficial))[0]
}

/** How to put a server's command on PATH. */
export function installHint(command: string, isWindows: boolean): string {
  const hints: Record<string, string> = {
    'csharp-ls': 'dotnet tool install --global csharp-ls',
    'typescript-language-server': 'npm install --global typescript-language-server typescript',
    'pyright-langserver': 'npm install --global pyright',
    gopls: 'go install golang.org/x/tools/gopls@latest',
    clangd: isWindows ? 'winget install LLVM.clangd' : 'install clangd with your package manager',
    'lua-language-server': isWindows ? 'winget install LuaLS.lua-language-server' : 'install lua-language-server with your package manager',
    'rust-analyzer': 'rustup component add rust-analyzer',
    intelephense: 'npm install --global intelephense',
    'ruby-lsp': 'gem install ruby-lsp',
    jdtls: 'install Eclipse JDT LS and put jdtls on PATH',
    'kotlin-lsp': 'install kotlin-lsp from github.com/Kotlin/kotlin-lsp and put it on PATH',
    'sourcekit-lsp': 'install the Swift toolchain from swift.org, which ships sourcekit-lsp',
  }
  return hints[command] ?? `put ${command} on PATH`
}

export type Facts = {
  files: string[]
  /** Plugin servers and MCP servers alike. */
  servers: Server[]
  /** Plugin ids, by language id, that a marketplace offers without listing their servers. */
  hinted: Record<string, string[]>
  /** Where each server command was found on PATH, or null where it wasn't. */
  binaries: Record<string, string | null>
  /** Ids of the languages whose project file wasn't found. */
  missingProject: string[]
  isWindows: boolean
}

const ORDER: Record<Status, number> = { 'no-server': 0, disabled: 1, available: 2, ready: 3, mcp: 4, none: 5 }

/** One row per language in the folder: problems, then the LSP tool's, then MCP's; code before data; then by file count. */
export function rows(f: Facts): Row[] {
  const out: Row[] = []
  const plugins = f.servers.filter(s => !s.isMcp)
  const mcps = f.servers.filter(s => s.isMcp)
  for (const [id, t] of tally(f.files, f.servers).langs) {
    const lang = LANG_BY_ID.get(id)
    const notes = f.missingProject.includes(id) && lang?.project ? [lang.project.missing] : []
    const base = { lang: id, name: t.name, files: t.files, sample: t.sample, notes }
    const s = pick(t.exts, plugins)
    const m = pick(t.exts, mcps)
    const meanwhile = m ? [`The ${m.plugin} MCP server covers it read-only in the meantime.`] : []

    if (!s) {
      const hint = f.hinted[id]?.[0]
      if (hint)
        out.push({
          ...base,
          status: 'available',
          plugin: hint,
          fix: `claude plugin install ${hint}`,
          notes: [...notes, 'Its marketplace entry names no server, so read its README for what else to install.', ...meanwhile],
        })
      else if (m)
        out.push({
          ...base,
          status: 'mcp',
          server: m.name,
          mcp: m.plugin,
          notes: [...notes, "No Claude Code plugin covers it, so the LSP tool can't. The MCP server's own tools can, read-only."],
        })
      else if (!lang?.isData) out.push({ ...base, status: 'none' })
      continue
    }

    const left = [...t.exts.keys()].filter(e => !s.exts.includes(e))
    if (left.length) notes.push(`${s.name} doesn't take ${left.join(', ')} files.`)
    const binary = f.binaries[s.command] ?? undefined
    const row = { ...base, plugin: s.plugin, server: s.name, command: s.command, binary }
    const install = installHint(s.command, f.isWindows)

    if (s.isInstalled && s.isEnabled) {
      out.push(binary ? { ...row, status: 'ready' } : { ...row, status: 'no-server', fix: install, notes: [...notes, ...meanwhile] })
    } else if (s.isInstalled) {
      out.push({ ...row, status: 'disabled', fix: `claude plugin enable ${s.plugin}`, notes: [...notes, ...meanwhile] })
    } else {
      if (!binary) notes.push(`${s.command} isn't on PATH either: ${install}`)
      out.push({ ...row, status: 'available', fix: `claude plugin install ${s.plugin}`, notes: [...notes, ...meanwhile] })
    }
  }
  const isData = (r: Row) => Number(Boolean(LANG_BY_ID.get(r.lang)?.isData))
  return out.sort((a, b) => ORDER[a.status] - ORDER[b.status] || isData(a) - isData(b) || b.files - a.files)
}

/** Languages with a way to get a server, and how many have one now: the LSP tool's, or an MCP server's alone. */
export function coverage(rows: Row[]) {
  const need = rows.filter(x => x.status !== 'none')
  const ready = need.filter(x => x.status === 'ready').length
  const mcp = need.filter(x => x.status === 'mcp').length
  return { need: need.length, ready, mcp, covered: ready + mcp, hasMissingServer: need.some(x => x.status === 'no-server') }
}

export const LABEL: Record<Status, string> = {
  ready: 'ready',
  'no-server': 'server not on PATH',
  disabled: 'plugin off',
  available: 'plugin not installed',
  mcp: 'MCP only',
  none: 'no server',
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** The pane's first line and the command's: how much of the folder's code has a server. */
export function headline(rows: Row[], folder: string): string {
  const c = coverage(rows)
  if (!c.need) return `No code in ${folder} that a language server covers.`
  const viaMcp = !c.mcp ? '' : c.mcp === c.covered ? ', all through MCP only' : `, ${c.mcp} of them through MCP only`
  return `Language servers cover ${c.covered} of ${plural(c.need, 'language')} in ${folder}${viaMcp}.`
}

/** The slash command's answer: the headline, then a line per language. The model reads it too. */
export function summary(r: { rows: Row[]; folder: string; unplaced?: [string, number][] }): string {
  const none = r.rows.filter(x => x.status === 'none')
  const others = r.unplaced ?? []
  return [
    headline(r.rows, r.folder),
    ...r.rows
      .filter(x => x.status !== 'none')
      .flatMap(x => [
        `- ${x.name}: ${LABEL[x.status]}${x.server ? ` (${x.server})` : ''}.${x.fix ? ` Fix: \`${x.fix}\`` : ''}`,
        ...x.notes.map(n => `  ${n}`),
      ]),
    ...(none.length ? [`- No plugin or MCP server covers ${none.map(n => n.name).join(', ')}.`] : []),
    ...(others.length ? [`- Unknown file types with no server: ${others.map(([e, n]) => `${e} (${n})`).join(', ')}.`] : []),
  ].join('\n')
}

/** The first match `where` or `which` printed, preferring a Windows executable over a bare shell script. */
export function firstPath(stdout: string): string | undefined {
  const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  return lines.find(l => /\.(exe|cmd|bat|com)$/i.test(l)) ?? lines[0]
}

/** What the prompt box gets from Ask Claude to fix: each problem and the line that fixes it. */
export function fixRequest(rows: Row[], folder: string): string {
  const lines = rows
    .filter(r => r.fix)
    .map(r => {
      const why =
        r.status === 'no-server'
          ? `${r.command} isn't on PATH`
          : r.status === 'disabled'
            ? `${r.plugin} is installed but off`
            : `no LSP plugin is installed`
      return `- ${r.name} (${plural(r.files, 'file')}): ${why}. Fix: \`${r.fix}\``
    })
  return [
    `Set up LSP for ${folder}. The lsp-status mod found:`,
    ...lines,
    'Run the fixes, then tell me which ones need a session restart before the LSP tool picks them up.',
  ].join('\n')
}
