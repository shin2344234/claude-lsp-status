import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const CWD = 'C:\\work\\game'
const HOME = 'C:\\Users\\me'
const PLUGINS = `${HOME}\\.claude\\plugins`
const OFFICIAL = `${PLUGINS}\\marketplaces\\claude-plugins-official`
const PANE = { title: 'LSP', isFocused: false, bodyColumns: 70, placement: 'dock' } as never
const BAND = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 140 } as never
const RUN = { stderr: '', isStdoutTruncated: false, isStderrTruncated: false }

type World = {
  lsp?: { text: string; resultCount?: number; isError?: true }
  status?: (string | undefined)[]
  opened?: string[]
  /** An MCP server with an `lsp_status` tool that reports a PowerShell server. */
  hasMcp?: boolean
  files?: Record<string, string>
  env?: Record<string, string>
  dirs?: Record<string, { name: string; kind: 'file' | 'dir' }[]>
  /** Commands `where` finds, besides csharp-ls. */
  found?: Record<string, string>
}

/**
 * A Windows machine with C# and Python plugins on, csharp-ls installed and pyright missing; gopls
 * installed for another folder only; and a folder holding C#, Python, Go and PowerShell files.
 */
function world(on: On, w: World = {}) {
  const files: Record<string, string> = {
    [`${PLUGINS}\\known_marketplaces.json`]: JSON.stringify({ 'claude-plugins-official': { installLocation: OFFICIAL } }),
    [`${OFFICIAL}\\.claude-plugin\\marketplace.json`]: JSON.stringify({
      plugins: [
        { name: 'csharp-lsp', lspServers: { 'csharp-ls': { command: 'csharp-ls', extensionToLanguage: { '.cs': 'csharp' } } } },
        { name: 'pyright-lsp', lspServers: { pyright: { command: 'pyright-langserver', extensionToLanguage: { '.py': 'python' } } } },
        { name: 'gopls-lsp', lspServers: { gopls: { command: 'gopls', extensionToLanguage: { '.go': 'go' } } } },
        { name: 'commit-helper' },
      ],
    }),
    [`${PLUGINS}\\installed_plugins.json`]: JSON.stringify({
      plugins: {
        'csharp-lsp@claude-plugins-official': [{ scope: 'user', installPath: 'C:\\cache\\csharp-lsp' }],
        'pyright-lsp@claude-plugins-official': [{ scope: 'local', projectPath: CWD, installPath: 'C:\\cache\\pyright-lsp' }],
        'gopls-lsp@claude-plugins-official': [{ scope: 'local', projectPath: 'C:\\elsewhere', installPath: 'C:\\cache\\gopls-lsp' }],
      },
    }),
    ...w.files,
  }
  const found: Record<string, string> = { 'csharp-ls': `${HOME}\\.dotnet\\tools\\csharp-ls.exe`, ...w.found }
  mock.env(on, { OS: 'Windows_NT', USERPROFILE: HOME, ...w.env })
  mock.clock(on, { now: Date.parse('2026-10-19T12:00:00Z') })
  on('session.cwd', () => ({ value: CWD }) as never)
  on('settings.read', () => ({
    value: { enabledPlugins: { 'csharp-lsp@claude-plugins-official': true, 'pyright-lsp@claude-plugins-official': true, 'gopls-lsp@claude-plugins-official': true } },
  }) as never)
  on('fs.read', (_$, e) => {
    if (!(e.path in files)) throw new Error(`ENOENT ${e.path}`)
    return { value: files[e.path] } as never
  })
  on('fs.list', (_$, e) => ({ value: (w.dirs?.[e.path] ?? []).map(d => ({ ...d, size: 0, mtimeMs: 0, isLink: false })) }) as never)
  on('process.run', (_$, e) => {
    const [cmd, arg] = e.argv
    if (cmd === 'git') return { value: { exitCode: 0, stdout: 'Game.csproj\0src/Player.cs\0Player.cs\0tools/build.py\0cmd/main.go\0run.ps1\0', ...RUN } } as never
    const path = found[arg ?? '']
    return { value: { exitCode: path ? 0 : 1, stdout: path ? `${path}\r\n` : '', ...RUN } } as never
  })
  on('tool.list', () => ({ value: w.hasMcp ? [{ name: 'mcp__local_lsp__lsp_status', description: '', mcp: true }] : [] }) as never)
  on('mcp.call', (_$, e) => {
    if (!w.hasMcp || e.server !== 'local_lsp' || e.tool !== 'lsp_status') throw new Error('no such tool')
    const servers = [{ id: 'local-powershell', extensions: ['.ps1', '.psm1', '.psd1'] }]
    return { value: { content: [{ type: 'text', text: JSON.stringify({ servers }) }], isError: false } } as never
  })
  const lsp = w.lsp ?? { text: 'Found 4 symbols', resultCount: 4 }
  on('tool.call', { tool: 'LSP' }, () => ({ result: { resultCount: lsp.resultCount }, text: lsp.text, isError: lsp.isError }) as never)
  on('ui.open', (_$, e) => (w.opened?.push(e.id), { value: { isPlaced: true } }) as never)
  on('ui.status', (_$, e) => (w.status?.push(e.text), { value: undefined }) as never)
  on('command.register', () => ({ value: undefined }) as never)
}

const textOf = (ran: unknown) => (ran as { text?: string }).text

test('the pane shows each language and the status line counts the covered ones', async ($, on) => {
  const status: (string | undefined)[] = []
  world(on, { status })
  expect(textOf(await $.command.run({ command: 'lsp-status' } as never))).toBe(
    [
      'Language servers cover 1 of 3 languages in game.',
      '- Python: server not on PATH (pyright). Fix: `npm install --global pyright`',
      '- Go: plugin not installed (gopls). Fix: `claude plugin install gopls-lsp@claude-plugins-official`',
      '  No go.mod in this folder or above it, so gopls runs without a module.',
      "  gopls isn't on PATH either: go install golang.org/x/tools/gopls@latest",
      '- C#: ready (csharp-ls).',
      '- No plugin or MCP server covers PowerShell.',
    ].join('\n'),
  )
  expect(status.at(-1)).toBe('LSP 1/3')

  for (const surface of ['terminal', 'desktop'] as const) {
    const pane = await $.ui.mount({ plugin: 'lsp-status', surface, component: 'Pane', requestId: 'lsp-status', props: PANE })
    expect((await pane.find({ type: 'Text', text: /^Language servers cover/ }))?.text).toBe('Language servers cover 1 of 3 languages in game. 6 files read via git.')
    expect((await pane.find({ type: 'Text', text: /^server not on PATH$/ }))?.props.color).toBe('error')
    expect((await pane.find({ type: 'Text', text: /^Fix: npm/ }))?.text).toBe('Fix: npm install --global pyright')
    // gopls is installed for another folder only, so here it is a plugin to install.
    expect((await pane.find({ type: 'Text', text: /^Fix: claude plugin install gopls/ }))?.text).toBe('Fix: claude plugin install gopls-lsp@claude-plugins-official')
    expect((await pane.find({ type: 'Text', text: /csharp-ls\.exe$/ }))?.text).toBe('C:\\Users\\me\\.dotnet\\tools\\csharp-ls.exe')
    expect((await pane.find({ type: 'Text', text: /PowerShell/ }))?.text).toBe('No plugin or MCP server covers PowerShell (1).')
    expect((await pane.find({ key: 'fix' }))?.props.label).toBe('Ask Claude to fix')
    await pane.unmount()
  }
})

test('an MCP server with an lsp_status tool covers PowerShell', async ($, on) => {
  const status: (string | undefined)[] = []
  world(on, { status, hasMcp: true })
  const text = textOf(await $.command.run({ command: 'lsp-status' } as never)) ?? ''
  expect(text).toContain('Language servers cover 2 of 4 languages in game, 1 of them through MCP only.')
  expect(text).toContain('- PowerShell: MCP only (local-powershell).')
  expect(status.at(-1)).toBe('LSP 2/4')

  const pane = await $.ui.mount({ plugin: 'lsp-status', surface: 'desktop', component: 'Pane', requestId: 'lsp-status', props: PANE })
  expect((await pane.find({ type: 'Text', text: /MCP server$/ }))?.text).toBe('1 file · local-powershell through the local_lsp MCP server')
  expect((await pane.find({ type: 'Text', text: /^MCP only$/ }))?.props.color).toBe('suggestion')
  await pane.unmount()
})

test('plugins in CLAUDE_CODE_PLUGIN_DIRS and the skills folder count, and so do unknown file types', async ($, on) => {
  const skills = `${HOME}\\.claude\\skills`
  world(on, {
    env: { CLAUDE_CODE_PLUGIN_DIRS: 'C:\\mods\\ps-lsp;~\\mods\\none' },
    files: {
      'C:\\mods\\ps-lsp\\.claude-plugin\\plugin.json': JSON.stringify({
        name: 'ps-lsp',
        lspServers: { pses: { command: 'pses', extensionToLanguage: { '.ps1': 'powershell' } } },
      }),
      [`${skills}\\go-kit\\.claude-plugin\\plugin.json`]: JSON.stringify({ name: 'go-kit' }),
      [`${skills}\\go-kit\\.lsp.json`]: JSON.stringify({ gopls: { command: 'gopls', extensionToLanguage: { '.go': 'go' } } }),
    },
    dirs: { [skills]: [{ name: 'go-kit', kind: 'dir' }] },
    found: { pses: 'C:\\pses\\pses.cmd', gopls: 'C:\\go\\bin\\gopls.exe' },
  })
  const text = textOf(await $.command.run({ command: 'lsp-status' } as never)) ?? ''
  expect(text).toContain('- PowerShell: ready (pses).')
  expect(text).toContain('- Go: ready (gopls).')

  const pane = await $.ui.mount({ plugin: 'lsp-status', surface: 'terminal', component: 'Pane', requestId: 'lsp-status', props: PANE })
  expect((await pane.find({ type: 'Text', text: /ps-lsp@plugin-dir/ }))?.text).toBe('1 file · pses from ps-lsp@plugin-dir')
  expect((await pane.find({ type: 'Text', text: /go-kit@skills-dir/ }))?.text).toBe('1 file · gopls from go-kit@skills-dir')
  await pane.unmount()
})

test('Test asks the server through the LSP tool and shows the answer', async ($, on) => {
  world(on)
  await $.command.run({ command: 'lsp-status' } as never)
  const pane = await $.ui.mount({ plugin: 'lsp-status', surface: 'desktop', component: 'Pane', requestId: 'lsp-status', props: PANE })
  await pane.press({ key: 'test-csharp' })
  expect((await pane.find({ type: 'Text', text: /^Answered/ }))?.text).toBe('Answered with 4 symbols in Player.cs')
  await pane.unmount()
})

test('a failed Test shows the tool error', async ($, on) => {
  world(on, { lsp: { text: 'No LSP server available for file type: .cs', isError: true } })
  await $.command.run({ command: 'lsp-status' } as never)
  const pane = await $.ui.mount({ plugin: 'lsp-status', surface: 'terminal', component: 'Pane', requestId: 'lsp-status', props: PANE })
  await pane.press({ key: 'test-csharp' })
  expect((await pane.find({ type: 'Text', text: /No LSP server/ }))?.props.color).toBe('error')
  await pane.unmount()
})

test('the band shows a short LSP item whose button opens the pane', async ($, on) => {
  const opened: string[] = []
  world(on, { opened })
  // The engine draws nothing of its own in the band, so its answer is its empty drawing.
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'engine', ref: 0 }) as never)
  await $.command.run({ command: 'lsp-status' } as never)
  opened.length = 0

  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ plugin: 'lsp-status', surface, component: 'AbovePrompt', props: BAND })
    // One of three languages is covered and pyright is missing, so the item is red.
    const item = await band.find({ type: 'Text', text: /^LSP / })
    expect(item?.text).toBe('LSP 1/3')
    expect(item?.props.color).toBe('error')
    await band.press({ key: 'lsp-open' })
    await band.unmount()
  }
  expect(opened).toEqual(['lsp-status', 'lsp-status'])
})

test('the item joins the end of a line a plugin beneath drew, and yields to a survey', async ($, on) => {
  world(on)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box key="usage-line" flexDirection="row" flexWrap="wrap">
        <Text>5h 50%</Text>
      </Box>
    )
  })
  await $.command.run({ command: 'lsp-status' } as never)

  const band = await $.ui.mount({ plugin: 'lsp-status', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  const texts = (await band.findAll({ type: 'Text' })).map(t => t.text)
  expect(texts).toEqual(['5h 50%', 'LSP 1/3'])
  await band.unmount()

  const survey = await $.ui.mount({
    plugin: 'lsp-status',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: { hasSurvey: true, isWorking: false, maxRows: 10, bodyColumns: 140 } as never,
  })
  expect(await survey.find({ type: 'Text', text: /^LSP / })).toBeUndefined()
  await survey.unmount()
})
