import { atom, read, update } from 'claude-code'
import type { EngineInterface, FsEntry, Register } from 'claude-code'

import type { Probe, Report, Row } from '../types'
import { LABEL, LANGS, baseName, coverage, firstPath, fits, fixRequest, headline, mcpServersOf, pick, rows, serversOf, summary, tally, unplaced } from './scan'
import type { Server } from './scan'

const PANE = 'lsp-status'
const OFFICIAL = 'claude-plugins-official'
const MIN = 60_000

const report = atom({ plugin: 'lsp-status', key: 'report' } as const, null)
const scanning = atom({ plugin: 'lsp-status', key: 'isScanning' } as const, false)
const probes = atom({ plugin: 'lsp-status', key: 'probes' } as const, {})

// Folders a walk skips: build output, dependencies, caches. Dot folders are skipped too.
const SKIP = new Set(['node_modules', 'bin', 'obj', 'dist', 'build', 'out', 'target', 'vendor', 'packages', 'venv', 'env', '__pycache__', 'library', 'temp', 'pods', 'coverage'])
const MAX_DIRS = 3000
const MAX_DEPTH = 10

type Install = { scope: string; projectPath?: string; installPath: string }
type Entry = { name: string; lspServers?: unknown }

async function json<T>($: EngineInterface, path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await $.fs.read(path)) as T
  } catch {
    return undefined
  }
}

const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()

/** Tracked and unignored files from git, or a capped walk of the folder outside a repository. */
async function listFiles($: EngineInterface, cwd: string, join: (...p: string[]) => string) {
  try {
    const r = await $.process.run(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { timeoutMs: 20_000 })
    if (r.exitCode === 0) return { files: r.stdout.split('\0').filter(Boolean), via: 'git' as const, isCapped: r.isStdoutTruncated }
  } catch {}

  const files: string[] = []
  const queue: [string, number][] = [['', 0]]
  let dirs = 0
  while (queue.length && dirs < MAX_DIRS) {
    const [rel, depth] = queue.shift()!
    dirs++
    let entries: FsEntry[] = []
    try {
      entries = await $.fs.list(rel ? join(cwd, rel) : cwd)
    } catch {
      continue
    }
    for (const e of entries) {
      const path = rel ? `${rel}/${e.name}` : e.name
      if (e.kind === 'file') files.push(path)
      else if (e.kind === 'dir' && depth < MAX_DEPTH && !e.name.startsWith('.') && !SKIP.has(e.name.toLowerCase()))
        queue.push([path, depth + 1])
    }
  }
  return { files, via: 'walk' as const, isCapped: queue.length > 0 }
}

/** The servers a plugin's own manifest or `.lsp.json` declares, for a plugin folder on disk. */
async function serversIn($: EngineInterface, dir: string, join: (...p: string[]) => string) {
  const own = (await json<{ lspServers?: unknown }>($, join(dir, '.claude-plugin', 'plugin.json')))?.lspServers
  const declared = serversOf(typeof own === 'string' ? await json($, join(dir, own)) : own)
  return declared.length ? declared : serversOf(await json($, join(dir, '.lsp.json')))
}

/**
 * Language servers that MCP servers report. Every server with an `lsp_status` tool is asked. One
 * still connecting, or left out of the tool list, is found by "lsp" in its name in the user's MCP
 * config, this project's, or `.mcp.json`.
 */
async function mcpServers($: EngineInterface, globalConfig: string, cwd: string, join: (...p: string[]) => string) {
  const names = new Map<string, string>()
  const note = (name: string) => names.set(name.replace(/[^a-z0-9]/gi, '_').toLowerCase(), name)
  for (const t of await $.tool.list().catch(() => [])) {
    const m = /^mcp__(.+)__lsp_status$/.exec(t.name)
    if (m) note(m[1]!)
  }
  type McpConfig = { mcpServers?: Record<string, unknown> }
  const global = await json<McpConfig & { projects?: Record<string, McpConfig> }>($, globalConfig)
  const project = Object.entries(global?.projects ?? {}).find(([p]) => norm(p) === norm(cwd))?.[1]
  const local = await json<McpConfig>($, join(cwd, '.mcp.json'))
  for (const c of [global, project, local]) for (const name of Object.keys(c?.mcpServers ?? {})) if (/lsp/i.test(name)) note(name)

  const out: Server[] = []
  for (const name of names.values()) {
    // A server that never answers costs ten seconds, not the scan.
    const answer = await Promise.race([$.mcp.call(name, 'lsp_status').catch(() => undefined), $.clock.sleep(10_000).then(() => undefined)])
    const block = answer && !answer.isError ? (answer.content.find(c => c.type === 'text') as { text?: string } | undefined) : undefined
    try {
      out.push(...mcpServersOf(name, answer?.structuredContent ?? JSON.parse(block?.text ?? 'null')))
    } catch {}
  }
  return out
}

/**
 * Every language server you can reach: the plugins in your marketplaces and their installs, the
 * plugins loaded from CLAUDE_CODE_PLUGIN_DIRS and the skills folders, and the language servers an
 * MCP server reports. A marketplace entry usually lists its plugin's servers; an installed plugin
 * whose entry doesn't may list them in its own manifest or `.lsp.json`.
 */
async function gatherServers($: EngineInterface, cwd: string, join: (...p: string[]) => string, isWindows: boolean) {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '~'
  const custom = await $.env.get('CLAUDE_CONFIG_DIR')
  const config = custom ?? join(home, '.claude')
  const plugins = join(config, 'plugins')
  const markets = (await json<Record<string, { installLocation?: string }>>($, join(plugins, 'known_marketplaces.json'))) ?? {}
  const installed = (await json<{ plugins?: Record<string, Install[]> }>($, join(plugins, 'installed_plugins.json')))?.plugins ?? {}
  const settings = await $.settings.read()
  const enabled = (settings.enabledPlugins ?? {}) as Record<string, unknown>
  const here = norm(cwd)

  // A user install counts everywhere; a project or local one only in its folder and below.
  const installFor = (id: string) =>
    installed[id]?.find(
      i => i.scope === 'user' || i.scope === 'managed' || (i.projectPath && (here === norm(i.projectPath) || here.startsWith(norm(i.projectPath) + '/'))),
    )

  const servers: Server[] = []
  const hinted: Record<string, string[]> = {}
  const seen = new Set<string>()
  const hintName = new Map(LANGS.flatMap(l => (l.plugins ?? []).map(p => [p, l.id] as const)))

  const add = async (id: string, block: unknown) => {
    seen.add(id)
    const inst = installFor(id)
    let declared = serversOf(block)
    if (!declared.length && inst) declared = await serversIn($, inst.installPath, join)
    for (const d of declared)
      servers.push({ ...d, plugin: id, isInstalled: Boolean(inst), isEnabled: enabled[id] === true, isOfficial: id.endsWith(`@${OFFICIAL}`), isMcp: false })
    const lang = hintName.get(id.split('@')[0]!)
    if (!declared.length && lang && !inst) (hinted[lang] ??= []).push(id)
  }

  for (const [market, m] of Object.entries(markets)) {
    if (!m.installLocation) continue
    const entries = (await json<{ plugins?: Entry[] }>($, join(m.installLocation, '.claude-plugin', 'marketplace.json')))?.plugins ?? []
    for (const p of entries) {
      const id = `${p.name}@${market}`
      if (p.lspServers || installed[id] || hintName.has(p.name)) await add(id, p.lspServers)
    }
  }
  // Installed from a marketplace that is gone, or from a folder.
  for (const id of Object.keys(installed)) if (!seen.has(id)) await add(id, undefined)

  // A plugin folder named in CLAUDE_CODE_PLUGIN_DIRS always loads. One under a skills folder loads
  // as <name>@skills-dir unless the settings switch it off.
  const fromFolder = async (dir: string, kind: string, isEnabled: (id: string) => boolean) => {
    const name = (await json<{ name?: string }>($, join(dir, '.claude-plugin', 'plugin.json')))?.name
    if (!name) return
    const id = `${name}@${kind}`
    for (const d of await serversIn($, dir, join)) servers.push({ ...d, plugin: id, isInstalled: true, isEnabled: isEnabled(id), isOfficial: false, isMcp: false })
  }
  const dirs = (await $.env.get('CLAUDE_CODE_PLUGIN_DIRS')) ?? (settings.env as Record<string, string> | undefined)?.CLAUDE_CODE_PLUGIN_DIRS ?? ''
  for (const dir of dirs.split(isWindows ? ';' : ':').map(d => d.trim()).filter(Boolean))
    await fromFolder(dir.replace(/^~(?=[\\/]|$)/, home), 'plugin-dir', () => true)
  for (const root of [join(config, 'skills'), join(cwd, '.claude', 'skills')])
    for (const e of await $.fs.list(root).catch(() => []))
      if (e.kind === 'dir') await fromFolder(join(root, e.name), 'skills-dir', id => enabled[id] !== false)

  servers.push(...(await mcpServers($, custom ? join(config, '.claude.json') : join(home, '.claude.json'), cwd, join)))
  return { servers, hinted }
}

/** Languages whose project file is in neither the folder's files nor, where the server looks up, a folder above. */
async function missingProjects($: EngineInterface, cwd: string, files: string[], present: string[], join: (...p: string[]) => string) {
  const missing: string[] = []
  for (const id of present) {
    const p = LANGS.find(l => l.id === id)?.project
    if (!p) continue
    if (files.some(f => p.files.some(pat => fits(baseName(f), pat)))) continue
    let found = false
    if (p.looksUp) {
      const parts = cwd.split(/[\\/]/)
      for (let n = parts.length - 1; n > 0 && !found; n--) {
        // A drive or the POSIX root needs its separator: `C:` alone is the drive's current folder.
        const dir = join(...parts.slice(0, n))
        const names = await $.fs.list(dir === '' || dir.endsWith(':') ? dir + '/' : dir).then(es => es.map(e => e.name), () => [])
        found = names.some(name => p.files.some(pat => fits(name, pat)))
      }
    }
    if (!found) missing.push(id)
  }
  return missing
}

async function gather($: EngineInterface): Promise<Report> {
  const cwd = await $.session.cwd()
  const sep = cwd.includes('\\') ? '\\' : '/'
  const join = (...p: string[]) => p.join(sep)
  const isWindows = (await $.env.get('OS')) === 'Windows_NT'

  const { files, via, isCapped } = await listFiles($, cwd, join)
  const { servers, hinted } = await gatherServers($, cwd, join, isWindows)
  const counts = tally(files, servers).langs
  const plugins = servers.filter(s => !s.isMcp)

  // Only the commands of the plugin servers that would be picked get looked up.
  const binaries: Record<string, string | null> = {}
  for (const t of counts.values()) {
    const s = pick(t.exts, plugins)
    if (!s || s.command in binaries) continue
    const r = await $.process.run([isWindows ? 'where' : 'which', s.command], { timeoutMs: 10_000 }).catch(() => undefined)
    binaries[s.command] = r?.exitCode === 0 ? (firstPath(r.stdout) ?? null) : null
  }

  const missingProject = await missingProjects($, cwd, files, [...counts.keys()], join)
  return {
    at: await $.clock.now(),
    cwd,
    folder: cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd,
    files: files.length,
    via,
    isCapped,
    rows: rows({ files, servers, hinted, binaries, missingProject, isWindows }),
    unplaced: unplaced(files, servers),
  }
}

// ponytail: module state, so a reload mid-scan starts a second one; both write the same report.
let running: Promise<void> | null = null

/** Scans the folder, unless a scan is already running, and updates the pane and the status line. */
function scan($: EngineInterface): Promise<void> {
  running ??= (async () => {
    await update($, scanning, () => true)
    try {
      const r = await gather($)
      await update($, report, () => r)
      const c = coverage(r.rows)
      $.ui.status(c.need ? `LSP ${c.covered}/${c.need}` : undefined)
    } finally {
      await update($, scanning, () => false)
      running = null
    }
  })()
  return running
}

/** Asks the language's server for the sample file's symbols through the LSP tool, as the model would. */
async function test($: EngineInterface, row: Row, cwd: string) {
  const set = (p: Probe) => update($, probes, all => ({ ...all, [row.lang]: p }))
  await set({ state: 'running', text: `Asking ${row.server} about ${row.sample}` })
  const filePath = `${cwd}${cwd.includes('\\') ? '\\' : '/'}${row.sample.replace(/\//g, cwd.includes('\\') ? '\\' : '/')}`
  try {
    const r = await $.tool.call({ tool: 'LSP', operation: 'documentSymbol', filePath, line: 1, character: 1 })
    const text = (r.deny ?? r.text ?? '').trim()
    const first = text.split('\n')[0]?.slice(0, 160) ?? ''
    if (r.deny || r.isError || /no lsp server|not available|error|failed|timed out/i.test(first)) {
      await set({ state: 'failed', text: first || 'The LSP tool answered with an error.' })
      return
    }
    const count = (r.result as { resultCount?: number } | undefined)?.resultCount
    await set({ state: 'ok', text: count !== undefined ? `Answered with ${count} symbols in ${row.sample}` : `Answered: ${first}` })
  } catch {
    await set({ state: 'failed', text: 'This session has no LSP tool. Restart it after enabling an LSP plugin.' })
  }
}

async function askFix($: EngineInterface, r: Report) {
  const filled = await $.prompt.fill({ text: fixRequest(r.rows, r.folder) }).catch(() => undefined)
  if (!filled?.isFilled) $.ui.toast('Could not fill the prompt box. The fixes are listed in the LSP pane.')
}

const COLOR: Record<Row['status'], string | undefined> = {
  ready: 'success',
  'no-server': 'error',
  disabled: 'warning',
  available: 'warning',
  mcp: 'suggestion',
  none: undefined,
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'lsp-status', description: 'Check LSP coverage for this folder and open the LSP pane' })
    void scan($)
    return started
  })

  on('command.run', { command: 'lsp-status' }, async $ => {
    await $.ui.open({ id: PANE, title: 'LSP' })
    await scan($)
    const r = await read($, report)
    return { text: r ? summary(r) : 'The scan did not finish.' }
  })

  // Files, settings and the folder itself change during a session. A minute between scans keeps it cheap.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (!e.agentId) {
      const r = await read($, report)
      if (!r || r.cwd !== (await $.session.cwd()) || (await $.clock.now()) - r.at > MIN) void scan($)
    }
    return done
  })

  // A short item in the band above the prompt. Whatever a plugin beneath drew stays first: the
  // item joins the end of its line. A plugin above that draws its own line shows this one only if
  // it does the same with what its own next(e) returns.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const c = coverage((await read($, report))?.rows ?? [])
    if (e.props.hasSurvey || !c.need) return below

    const { Box, Text, Button } = $.ui.resolve(e)
    const isAll = c.covered === c.need
    const color = isAll ? 'success' : c.hasMissingServer ? 'error' : 'warning'
    const item = (
      <Box key="lsp-status-band" flexDirection="row" gap={1} marginLeft={2} alignItems="center">
        <Text color={color}>LSP {isAll ? 'ready' : `${c.covered}/${c.need}`}</Text>
        <Button key="lsp-open" label="Open" plain onPress={() => $.ui.open({ id: PANE, title: 'LSP' })} />
      </Box>
    )
    if (below.type === 'engine') return item
    if (below.type === 'Box') return { ...below, children: [...(below.children ?? []), item] }
    return (
      <Box flexDirection="row" flexWrap="wrap" alignItems="center">
        {below}
        {item}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const r = await read($, report)
    const isScanning = await read($, scanning)
    const tested = await read($, probes)
    if (!r) return <Text dimColor>{isScanning ? 'Reading the folder…' : 'No scan yet. Run /lsp-status.'}</Text>

    const shown = r.rows.filter(x => x.status !== 'none')
    const none = r.rows.filter(x => x.status === 'none')
    // A report kept from before the mod listed unknown file types has none.
    const others = r.unplaced ?? []
    const hasFixes = shown.some(x => x.fix)

    const card = (row: Row) => {
      const probe = tested[row.lang]
      return (
        <Box flexDirection="column" borderStyle="round" borderColor={COLOR[row.status] ?? 'claude'} paddingX={1} marginBottom={1}>
          <Box flexDirection="row" justifyContent="space-between">
            <Text weight="semibold">{row.name}</Text>
            <Text color={COLOR[row.status]}>{LABEL[row.status]}</Text>
          </Box>
          <Text dimColor wrap="wrap">
            {row.files} {row.files === 1 ? 'file' : 'files'}
            {row.mcp
              ? ` · ${row.server} through the ${row.mcp} MCP server`
              : row.server
                ? ` · ${row.server} from ${row.plugin}`
                : row.plugin
                  ? ` · ${row.plugin}`
                  : ''}
          </Text>
          {row.binary && <Text dimColor wrap="wrap">{row.binary}</Text>}
          {row.fix && <Text wrap="wrap">Fix: {row.fix}</Text>}
          {row.notes.map(n => (
            <Text color={row.status === 'mcp' ? undefined : 'warning'} dimColor={row.status === 'mcp'} wrap="wrap">
              {n}
            </Text>
          ))}
          {row.status === 'ready' && (
            <Box flexDirection="row" gap={1} marginTop={1}>
              <Button
                key={`test-${row.lang}`}
                label={probe?.state === 'running' ? 'Testing…' : 'Test'}
                onPress={() => (probe?.state === 'running' ? undefined : test($, row, r.cwd))}
              />
              {probe && (
                <Text color={probe.state === 'ok' ? 'success' : probe.state === 'failed' ? 'error' : undefined} dimColor={probe.state === 'running'} wrap="wrap">
                  {probe.text}
                </Text>
              )}
            </Box>
          )}
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
          <Box flexDirection="column">
            <Text weight="semibold">{r.folder}</Text>
            <Text dimColor wrap="wrap">
              {headline(r.rows, r.folder)}
              {` ${r.files} files read via ${r.via === 'git' ? 'git' : 'a folder walk'}${r.isCapped ? ', stopped early' : ''}.`}
            </Text>
          </Box>
          <Button key="rescan" label={isScanning ? 'Scanning…' : 'Rescan'} onPress={() => scan($)} />
        </Box>
        {shown.map(card)}
        {none.length > 0 && (
          <Text dimColor wrap="wrap">
            No plugin or MCP server covers {none.map(n => `${n.name} (${n.files})`).join(', ')}.
          </Text>
        )}
        {others.length > 0 && (
          <Text dimColor wrap="wrap">
            Unknown file types with no server: {others.map(([ext, n]) => `${ext} (${n})`).join(', ')}.
          </Text>
        )}
        {hasFixes && (
          <Box marginTop={1}>
            <Button key="fix" label="Ask Claude to fix" variant="primary" onPress={() => askFix($, r)} />
          </Box>
        )}
      </Box>
    )
  })
}
