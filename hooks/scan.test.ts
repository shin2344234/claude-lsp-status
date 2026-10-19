import { expect, test } from 'claude-code/testing'

import { coverage, extOf, firstPath, fits, fixRequest, headline, mcpServersOf, pick, rows, serversOf, summary, tally, unplaced } from './scan'
import type { Facts, Server } from './scan'

const server = (over: Partial<Server>): Server => ({
  plugin: 'x@m',
  name: 'x',
  command: 'x',
  exts: [],
  langs: {},
  isInstalled: true,
  isEnabled: true,
  isOfficial: false,
  isMcp: false,
  ...over,
})

const CSHARP = server({ plugin: 'csharp-lsp@claude-plugins-official', name: 'csharp-ls', command: 'csharp-ls', exts: ['.cs'], isOfficial: true })
const PYRIGHT = server({ plugin: 'pyright-lsp@claude-plugins-official', name: 'pyright', command: 'pyright-langserver', exts: ['.py', '.pyi'], isOfficial: true })
const LOCAL = mcpServersOf('local_lsp', {
  servers: [
    { id: 'local-powershell', extensions: ['.ps1', '.psm1', '.psd1'] },
    { id: 'local-python', extensions: ['.py', '.pyi'] },
    { id: 'local-json', extensions: ['.json', '.jsonc'] },
    { id: 'local-dockerfile', extensions: ['.dockerfile', 'Dockerfile'] },
    { id: 'local-zed', extensions: ['.zz'] },
  ],
})
const facts = (over: Partial<Facts>): Facts => ({ files: [], servers: [], hinted: {}, binaries: {}, missingProject: [], isWindows: true, ...over })
const byLang = (f: Facts) => Object.fromEntries(rows(f).map(r => [r.lang, r]))

test('extensions, patterns and where output', () => {
  expect(extOf('src/Thing.CS')).toBe('.cs')
  expect(extOf('.gitignore')).toBe('')
  expect(extOf('a.b/Makefile')).toBe('')
  expect(fits('Game.SLN', '*.sln')).toBe(true)
  expect(fits('go.mod', 'go.mod')).toBe(true)
  expect(fits('go.sum', 'go.mod')).toBe(false)
  expect(firstPath('C:\\npm\\typescript-language-server\r\nC:\\npm\\typescript-language-server.cmd\r\n')).toBe('C:\\npm\\typescript-language-server.cmd')
  expect(firstPath('/usr/bin/gopls\n')).toBe('/usr/bin/gopls')
})

test('tally groups files by language and keeps the shallowest sample', () => {
  const t = tally(['a/b/deep.cs', 'top.cs', 'x.ts', 'y.mjs', 'README.md', 'data.json']).langs
  expect(t.get('csharp')?.files).toBe(2)
  expect(t.get('csharp')?.sample).toBe('top.cs')
  expect(t.get('ts')?.exts.get('.mjs')).toBe(1)
  expect(t.get('json')?.files).toBe(1)
})

test('serversOf and mcpServersOf read servers and ignore anything else', () => {
  expect(serversOf({ clangd: { command: 'clangd', extensionToLanguage: { '.C': 'cpp', '.h': 'c' } } })).toEqual([
    { name: 'clangd', command: 'clangd', exts: ['.c', '.h'], langs: { '.c': 'cpp', '.h': 'c' } },
  ])
  expect(serversOf(null)).toEqual([])
  expect(serversOf('./.lsp.json')).toEqual([])
  expect(serversOf({ broken: { command: 3 } })).toEqual([])

  const [ps] = LOCAL
  expect(ps?.plugin).toBe('local_lsp')
  expect(ps?.name).toBe('local-powershell')
  expect(ps?.isMcp).toBe(true)
  expect(LOCAL.find(s => s.name === 'local-dockerfile')?.exts).toEqual(['.dockerfile', 'dockerfile'])
  expect(mcpServersOf('x', { servers: [{ id: 3 }, null] })).toEqual([])
  expect(mcpServersOf('x', 'not json')).toEqual([])
})

test('pick prefers an enabled server, then the one covering more files', () => {
  const off = server({ plugin: 'a@m', exts: ['.cs'], isEnabled: false })
  const on = server({ plugin: 'b@m', exts: ['.cs'] })
  const exts = new Map([['.cs', 10]])
  expect(pick(exts, [off, on])?.plugin).toBe('b@m')
  expect(pick(new Map([['.go', 1]]), [off, on])).toBeUndefined()
})

test('rows give each language its status and fix', () => {
  const got = rows(
    facts({
      files: ['App.cs', 'tool.py', 'scene.gd', 'run.ps1', 'lib.rs'],
      servers: [
        CSHARP,
        PYRIGHT,
        server({ plugin: 'rust-analyzer-lsp@claude-plugins-official', name: 'rust-analyzer', command: 'rust-analyzer', exts: ['.rs'], isInstalled: false, isEnabled: false }),
      ],
      hinted: { gdscript: ['godot-lsp-bridge@claude-community'] },
      binaries: { 'csharp-ls': 'C:\\tools\\csharp-ls.exe', 'pyright-langserver': null, 'rust-analyzer': null },
      missingProject: ['csharp'],
    }),
  )
  const by = Object.fromEntries(got.map(r => [r.lang, r]))

  expect(by.csharp?.status).toBe('ready')
  expect(by.csharp?.binary).toBe('C:\\tools\\csharp-ls.exe')
  expect(by.csharp?.notes[0]).toMatch(/No \.sln or \.csproj/)

  expect(by.python?.status).toBe('no-server')
  expect(by.python?.fix).toBe('npm install --global pyright')

  expect(by.rust?.status).toBe('available')
  expect(by.rust?.fix).toBe('claude plugin install rust-analyzer-lsp@claude-plugins-official')
  expect(by.rust?.notes[0]).toBe("rust-analyzer isn't on PATH either: rustup component add rust-analyzer")

  expect(by.gdscript?.status).toBe('available')
  expect(by.gdscript?.fix).toBe('claude plugin install godot-lsp-bridge@claude-community')

  expect(by.powershell?.status).toBe('none')
  expect(by.powershell?.fix).toBeUndefined()

  // Problems first, languages nothing covers last.
  expect(got.map(r => r.status)).toEqual(['no-server', 'available', 'available', 'ready', 'none'])
})

test('a disabled plugin gets an enable line, and uncovered extensions get a note', () => {
  const [row] = rows(
    facts({
      files: ['a.cpp', 'b.hh'],
      servers: [server({ plugin: 'clangd-lsp@claude-plugins-official', name: 'clangd', command: 'clangd', exts: ['.cpp'], isEnabled: false })],
      binaries: { clangd: '/usr/bin/clangd' },
    }),
  )
  expect(row?.status).toBe('disabled')
  expect(row?.fix).toBe('claude plugin enable clangd-lsp@claude-plugins-official')
  expect(row?.notes).toEqual(["clangd doesn't take .hh files."])
})

test('an MCP server covers what no plugin does, and stands in while a plugin is broken', () => {
  const by = byLang(
    facts({
      files: ['run.ps1', 'tool.py', 'Dockerfile', 'thing.zz', 'package.json'],
      servers: [PYRIGHT, ...LOCAL],
      binaries: { 'pyright-langserver': null },
    }),
  )
  expect(by.powershell?.status).toBe('mcp')
  expect(by.powershell?.server).toBe('local-powershell')
  expect(by.powershell?.mcp).toBe('local_lsp')
  expect(by.powershell?.fix).toBeUndefined()

  // pyright is the plugin's and missing; the MCP server's Python server fills in meanwhile.
  expect(by.python?.status).toBe('no-server')
  expect(by.python?.notes).toContain('The local_lsp MCP server covers it read-only in the meantime.')

  // A file name a server declares is a language, and so is an extension the table lacks.
  expect(by.dockerfile?.status).toBe('mcp')
  expect(by.zed?.name).toBe('Zed')
  expect(by.zed?.status).toBe('mcp')
  // A data format shows once a server covers it.
  expect(by.json?.status).toBe('mcp')
})

test('data formats nothing covers stay out, and unknown code types are listed', () => {
  const files = ['package.json', 'a.yml', 'x.foo', 'y.foo', 'z.bar', 'logo.png', 'yarn.lock', 'scene.tscn', 'notes.txt', 'lib.so.1']
  expect(rows(facts({ files }))).toEqual([])
  expect(unplaced(files, [])).toEqual([
    ['.foo', 2],
    ['.bar', 1],
  ])
  // A type some server declares is no longer unknown.
  expect(unplaced(files, [server({ exts: ['.foo'] })])).toEqual([['.bar', 1]])
})

test('coverage, the headline and the summary count MCP-only languages as covered', () => {
  const got = rows(facts({ files: ['App.cs', 'run.ps1', 'x.py', 'deploy.sh'], servers: [CSHARP, ...LOCAL], binaries: { 'csharp-ls': 'x' } }))
  expect(coverage(got)).toEqual({ need: 3, ready: 1, mcp: 2, covered: 3, hasMissingServer: false })
  expect(headline(got, 'game')).toBe('Language servers cover 3 of 3 languages in game, 2 of them through MCP only.')
  expect(summary({ rows: got, folder: 'game', unplaced: [['.foo', 2]] })).toBe(
    [
      'Language servers cover 3 of 3 languages in game, 2 of them through MCP only.',
      '- C#: ready (csharp-ls).',
      '- PowerShell: MCP only (local-powershell).',
      "  No Claude Code plugin covers it, so the LSP tool can't. The MCP server's own tools can, read-only.",
      '- Python: MCP only (local-python).',
      "  No Claude Code plugin covers it, so the LSP tool can't. The MCP server's own tools can, read-only.",
      '- No plugin or MCP server covers Shell.',
      '- Unknown file types with no server: .foo (2).',
    ].join('\n'),
  )
  expect(headline([], 'empty')).toBe('No code in empty that a language server covers.')
  const onlyMcp = rows(facts({ files: ['run.ps1', 'big.json', 'a.json'], servers: LOCAL }))
  expect(headline(onlyMcp, 'scripts')).toBe('Language servers cover 2 of 2 languages in scripts, all through MCP only.')
  // Code before data within the same state, whatever the file counts.
  expect(onlyMcp.map(r => r.lang)).toEqual(['powershell', 'json'])
})

test('the fix request lists only rows with a fix', () => {
  const got = rows(facts({ files: ['a.cs', 'b.py'], servers: [CSHARP, PYRIGHT], binaries: { 'csharp-ls': 'x', 'pyright-langserver': null } }))
  const text = fixRequest(got, 'game')
  expect(text).toContain('Set up LSP for game.')
  expect(text).toContain("- Python (1 file): pyright-langserver isn't on PATH. Fix: `npm install --global pyright`")
  expect(text).not.toContain('C#')
})
