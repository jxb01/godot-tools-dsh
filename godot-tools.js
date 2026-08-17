'use strict'
/**
 * godot-tools — a DeepSeek Harness plugin that drives the local Godot
 * executable (headless CLI + editor launcher) through native agent tools.
 *
 * Loaded via cordis.patch.yml in the web profile (name must be a file:// URL
 * on Windows). Fully reversible:
 *   powershell -ExecutionPolicy Bypass -File C:\Users\JG\.dsh\profiles\web\revert-godot-tools.ps1
 *
 * In-session control: the godot_toggle tool enables/disables the godot_*
 * tools live, no restart needed. State resets to enabled on harness restart.
 */
const { spawn } = require('node:child_process')
const { readdir } = require('node:fs/promises')
const path = require('node:path')
// Lazy + guarded require: a version mismatch must never take the harness down.
let defineTool
try {
  ;({ defineTool } = require('@deepseek-ai/dsh-tools'))
} catch (err) {
  console.error('[godot-tools] @deepseek-ai/dsh-tools unavailable:', err.message)
}

// The workspace is a folder named "...Godot_v4.7.1-stable_win64.exe"; the real
// executables live inside it. The _console variant is the right one for headless runs.
const DEFAULT_GODOT_EXE = 'D:\\download\\Godot_v4.7.1-stable_win64.exe\\Godot_v4.7.1-stable_win64_console.exe'
const OUTPUT_CAP = 12000

exports.name = 'godot-tools'
exports.inject = ['tools']

exports.apply = function apply(ctx, config = {}) {
  const godotExe = config.godotExe || DEFAULT_GODOT_EXE

  if (!defineTool) {
    console.error('[godot-tools] defineTool unavailable — godot tools not registered (harness keeps booting).')
    return
  }

  // Registration failures must degrade gracefully: log, never throw into the boot.
  // ctx.tools.register returns a disposer, kept so godot_toggle can revoke tools.
  const disposers = []
  function safeRegister(def) {
    try {
      disposers.push(ctx.tools.register(def))
      return true
    } catch (err) {
      console.error('[godot-tools] failed to register ' + def.name + ':', err.message)
      return false
    }
  }

  function cap(text) {
    if (text.length <= OUTPUT_CAP) return text
    return '...[truncated ' + (text.length - OUTPUT_CAP) + ' chars]...\n' + text.slice(-OUTPUT_CAP)
  }

  function renderText(args, value) {
    return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
  }

  const projectParam = () => ({ type: 'string', required: true, description: 'Absolute path to the Godot project directory (the folder containing project.godot)' })

  const runOutput = () => ({
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', required: true, description: 'Whether Godot exited cleanly' },
        exitCode: { type: 'number', required: true, description: 'Process exit code (null when spawn failed)' },
        timedOut: { type: 'boolean', required: true, description: 'Whether the run was killed after the timeout' },
        output: { type: 'string', required: true, description: 'Captured stdout+stderr (tail-capped)' },
      },
      additionalProperties: false,
    },
    render: renderText,
  })

  function registerAll() {
    safeRegister(defineTool({
      name: 'godot_check',
      description: 'Validate a Godot project headless: imports resources and runs the first frame. Use to confirm a project opens without script or resource errors.',
      parameters: { project: projectParam() },
      output: runOutput(),
      execute: async (args, exec) => {
        const r = await runGodot(['--headless', '--path', args.project, '--quit'], { signal: exec.signal, timeoutMs: 120000 })
        return { ok: r.code === 0 && !r.timedOut, exitCode: r.code, timedOut: r.timedOut, output: cap((r.stdout + r.stderr).trim()) }
      },
    }))

    safeRegister(defineTool({
      name: 'godot_import',
      description: 'Re-import all assets of a Godot project headless (the import step the editor runs). Use after adding assets or changing import settings.',
      parameters: { project: projectParam() },
      output: runOutput(),
      execute: async (args, exec) => {
        const r = await runGodot(['--headless', '--path', args.project, '--import'], { signal: exec.signal, timeoutMs: 300000 })
        return { ok: r.code === 0 && !r.timedOut, exitCode: r.code, timedOut: r.timedOut, output: cap((r.stdout + r.stderr).trim()) }
      },
    }))

    safeRegister(defineTool({
      name: 'godot_run_scene',
      description: 'Run a scene of a Godot project headless for a fixed number of frames and capture engine output. Use to smoke-test a scene.',
      parameters: {
        project: projectParam(),
        scene: { type: 'string', required: true, description: 'Scene path, absolute or relative to the project (e.g. scenes/main.tscn or res://scenes/main.tscn)' },
        maxFrames: { type: 'number', description: 'Frames to run before quitting (default 60)' },
      },
      output: runOutput(),
      execute: async (args, exec) => {
        const frames = String(args.maxFrames ?? 60)
        const scene = args.scene.startsWith('res://') ? args.scene.slice(6) : args.scene
        const r = await runGodot(['--headless', '--path', args.project, path.resolve(args.project, scene), '--quit-after', frames], { signal: exec.signal, timeoutMs: 120000 })
        return { ok: r.code === 0 && !r.timedOut, exitCode: r.code, timedOut: r.timedOut, output: cap((r.stdout + r.stderr).trim()) }
      },
    }))

    safeRegister(defineTool({
      name: 'godot_run_script',
      description: 'Run a GDScript headless with Godot (the script must extend SceneTree or MainLoop). Captures print() output and the exit code.',
      parameters: {
        project: projectParam(),
        script: { type: 'string', required: true, description: 'Script path, absolute or relative to the project (e.g. scripts/check.gd)' },
        userArgs: { type: 'array', items: { type: 'string' }, description: 'Extra arguments passed after -- for OS.get_cmdline_user_args()' },
      },
      output: runOutput(),
      execute: async (args, exec) => {
        const script = path.resolve(args.project, String(args.script).replace(/^res:\/\//, ''))
        const cmd = ['--headless', '--path', args.project, '--script', script]
        if (Array.isArray(args.userArgs) && args.userArgs.length) cmd.push('--', ...args.userArgs)
        const r = await runGodot(cmd, { signal: exec.signal, timeoutMs: 120000 })
        return { ok: r.code === 0 && !r.timedOut, exitCode: r.code, timedOut: r.timedOut, output: cap((r.stdout + r.stderr).trim()) }
      },
    }))

    safeRegister(defineTool({
      name: 'godot_list_assets',
      description: 'List Godot asset files (.tscn, .gd, .tres) under a project directory, recursively, up to a cap.',
      parameters: {
        project: projectParam(),
        limit: { type: 'number', description: 'Max entries (default 200)' },
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            files: { type: 'array', items: { type: 'string' }, required: true },
          },
          additionalProperties: false,
        },
        render: renderText,
      },
      execute: async (args, exec) => {
        const limit = args.limit ?? 200
        const ext = new Set(['.tscn', '.gd', '.tres'])
        const files = []
        async function walk(dir) {
          if (exec.signal.aborted || files.length >= limit) return
          let entries
          try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
          for (const e of entries) {
            if (exec.signal.aborted || files.length >= limit) return
            const full = path.join(dir, e.name)
            if (e.isDirectory()) {
              if (e.name === '.godot' || e.name === '.git' || e.name === 'node_modules') continue
              await walk(full)
            } else if (ext.has(path.extname(e.name))) {
              files.push(full)
            }
          }
        }
        await walk(args.project)
        return { files: files.slice(0, limit) }
      },
    }))

    safeRegister(defineTool({
      name: 'godot_open_editor',
      description: 'Launch the Godot editor GUI on a project (detached; returns immediately).',
      parameters: { project: projectParam() },
      output: {
        schema: {
          type: 'object',
          properties: {
            ok: { type: 'boolean', required: true },
            note: { type: 'string', required: true },
          },
          additionalProperties: false,
        },
        render: renderText,
      },
      execute: async (args) => {
        const child = spawn(godotExe, ['--editor', '--path', args.project], { detached: true, stdio: 'ignore', windowsHide: true })
        child.unref()
        return { ok: true, note: 'Godot editor launched for ' + args.project }
      },
    }))
  }

  function runGodot(args, { signal, timeoutMs }) {
    return new Promise((resolve) => {
      let child
      let stdout = ''
      let stderr = ''
      let timedOut = false
      const kill = () => { try { child.kill() } catch { /* already gone */ } }
      const onAbort = () => kill()
      const timer = timeoutMs ? setTimeout(() => { timedOut = true; kill() }, timeoutMs) : null
      child = spawn(godotExe, args, { windowsHide: true })
      child.stdout.on('data', (d) => { stdout += d })
      child.stderr.on('data', (d) => { stderr += d })
      child.on('error', (err) => {
        if (timer) clearTimeout(timer)
        if (signal) signal.removeEventListener('abort', onAbort)
        resolve({ code: null, stdout, stderr: stderr + String(err), timedOut, error: err.message })
      })
      child.on('close', (code) => {
        if (timer) clearTimeout(timer)
        if (signal) signal.removeEventListener('abort', onAbort)
        resolve({ code, stdout, stderr, timedOut })
      })
      if (signal) {
        if (signal.aborted) kill()
        else signal.addEventListener('abort', onAbort, { once: true })
      }
    })
  }

  // ── Control plane: live enable/disable of the godot_* tools ───────────────
  let toolsEnabled = true
  ctx.tools.register(defineTool({
    name: 'godot_toggle',
    description: 'Enable or disable the godot_* tools in the current harness session, live, without restarting.',
    parameters: {
      enabled: { type: 'boolean', required: true, description: 'false unregisters all godot_* tools; true re-registers them. The godot_toggle tool itself always stays.' },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', required: true },
          note: { type: 'string', required: true },
        },
        additionalProperties: false,
      },
      render: renderText,
    },
    execute: async (args) => {
      if (args.enabled === toolsEnabled) {
        return { enabled: toolsEnabled, note: 'no change — already ' + (toolsEnabled ? 'enabled' : 'disabled') }
      }
      if (args.enabled) {
        registerAll()
        toolsEnabled = true
        return { enabled: true, note: 'godot tools re-enabled (' + disposers.length + ' registered)' }
      }
      for (const dispose of disposers.splice(0)) {
        try { dispose() } catch (err) { console.error('[godot-tools] dispose error:', err.message) }
      }
      toolsEnabled = false
      return { enabled: false, note: 'godot tools disabled (takes effect next step)' }
    },
  }))

  registerAll()
}
