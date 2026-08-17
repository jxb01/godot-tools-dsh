# godot-tools — DeepSeek Harness (DSH) plugin

Native agent tools that drive a **local Godot 4.x executable** (headless CLI + editor launcher) from inside [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). No MCP server, no network, no runtime npm installs.

/ 中文版见下方 / See the Chinese section below.

## Tools

| Tool | What it does |
|---|---|
| `godot_check` | Validate a Godot project headless (import + first frame); returns exit code + engine output |
| `godot_import` | Re-import all assets headless (the editor import step) |
| `godot_run_scene` | Run a scene headless for N frames; smoke-test scenes |
| `godot_run_script` | Run a GDScript headless (must extend SceneTree/MainLoop); captures print() and exit code |
| `godot_list_assets` | Recursively list `.tscn` / `.gd` / `.tres` under a project |
| `godot_open_editor` | Launch the Godot editor GUI on a project (detached) |
| `godot_toggle` | Live enable/disable of the `godot_*` tools in-session, no restart |

## Requirements

- DeepSeek Harness (web profile) — the plugin is a Cordis plugin loaded from the profile's `cordis.patch.yml`
- Godot 4.x executable (path configurable via `config.godotExe`)
- `@deepseek-ai/dsh-tools` — provided by the harness profile at runtime; no separate install

## Install

1. Copy `godot-tools.js` into your profile plugins dir, e.g.
   `C:\Users\<you>\.dsh\profiles\web\plugins\godot-tools.js`
2. Append to `C:\Users\<you>\.dsh\profiles\web\cordis.patch.yml` (see `cordis.patch.yml.example`):

   ```yaml
   - insert:
       - id: godot-tools
         name: 'file:///C:/Users/<you>/.dsh/profiles/web/plugins/godot-tools.js'
   ```

   > **Windows + ESM loader gotcha:** the `name` must be a `file://` URL. A bare
   > `C:/...` path fails at boot with `ERR_UNSUPPORTED_ESM_URL_SCHEME`.

3. Restart `dsh web`. The 7 tools appear in the agent chat.

## Configure

In the patch row's `config`:

```yaml
- insert:
    - id: godot-tools
      name: 'file:///C:/Users/<you>/.dsh/profiles/web/plugins/godot-tools.js'
      config:
        godotExe: 'D:/path/to/Godot_v4.7.1-stable_win64_console.exe'   # optional override
```

## Toggle / disable

- In-session: call `godot_toggle(enabled: false | true)`. State resets to enabled on harness restart.
- At boot: add `disabled: !!js process.env.GODOT_TOOLS === '0'` to the row and start dsh web with `GODOT_TOOLS=0`.

## Uninstall

- Run `revert-godot-tools.ps1` (adjust paths), or manually: remove the patch row from `cordis.patch.yml`, delete `godot-tools.js`, restart `dsh web`.

---

## 中文说明

在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 内原生驱动本地 **Godot 4.x** 可执行文件的 Agent 工具插件。无需 MCP 服务端、无需网络、运行时零 npm 依赖。

### 工具

| 工具 | 作用 |
|---|---|
| `godot_check` | 无头校验 Godot 项目（导入+首帧），返回退出码与引擎输出 |
| `godot_import` | 无头重导入全部资源（编辑器导入步骤） |
| `godot_run_scene` | 无头跑指定场景 N 帧（冒烟测试） |
| `godot_run_script` | 无头跑 GDScript（需 extends SceneTree/MainLoop），捕获 print() 与退出码 |
| `godot_list_assets` | 递归列出项目下的 `.tscn` / `.gd` / `.tres` |
| `godot_open_editor` | 以 GUI 打开 Godot 编辑器（分离进程） |
| `godot_toggle` | 会话内即时开启/关闭全部 `godot_*` 工具，无需重启 |

### 安装

1. 把 `godot-tools.js` 复制到 profile 插件目录，例如 `C:\Users\<你>\.dsh\profiles\web\plugins\godot-tools.js`
2. 在 `C:\Users\<你>\.dsh\profiles\web\cordis.patch.yml` 末尾追加（见 `cordis.patch.yml.example`）：

   ```yaml
   - insert:
       - id: godot-tools
         name: 'file:///C:/Users/<你>/.dsh/profiles/web/plugins/godot-tools.js'
   ```

   > **Windows + ESM 加载器注意**：`name` 必须是 `file://` URL；写成裸 `C:/...` 路径会在启动时报 `ERR_UNSUPPORTED_ESM_URL_SCHEME`。

3. 重启 `dsh web`，7 个工具即出现在对话中。

### 配置

在补丁行的 `config` 里可覆盖 Godot 路径（`godotExe`）。

### 开关

- 会话内：调用 `godot_toggle(enabled: false|true)`；重启后恢复默认开启。
- 启动级：给该行加 `disabled: !!js process.env.GODOT_TOOLS === '0'`，以 `GODOT_TOOLS=0` 启动即不加载。

### 卸载

运行 `revert-godot-tools.ps1`（按需改路径），或手动：从 `cordis.patch.yml` 移除该行、删除 `godot-tools.js`、重启 `dsh web`。

## License

MIT — see `LICENSE`.

## Credits / 致谢

- Author: jxb01 · Built with the assistance of DeepSeek (DeepSeek Harness) — assistant by DeepSeek
- 作者：jxb01 · 由 DeepSeek（DeepSeek Harness）辅助完成 — assistant by DeepSeek
