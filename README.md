# Brainstorm Studio

A brainstorming board for workshops, product discussions, travel planning, learning plans, event preparation, everyday decisions, and early-stage idea exploration. This is not the default Vite starter anymore. It is a working React app designed to turn vague thoughts into concrete directions.

Brainstorm Studio is built for people who know they need to think through a topic, but get stuck when they try to expand it on their own. Most brainstorming sessions do not need more noise; they need better prompts, better structure, and a way to keep pushing past the first obvious thought. This project uses local AI to help users branch out and keep exploring different directions instead of staring at a blank page.

Instead of replacing the user's thinking, the AI works like a brainstorming partner. It can react to the notes already on the board, follow weighted ideas more closely, and generate either more focused or more divergent suggestions depending on the slider in the UI. The goal is not to output one perfect answer. The goal is to help users discover directions they would not have reached by thinking alone.

## Features

- Auto-save to `localStorage`
- Cross-tab sync for the same board
- Manual note creation with tags, pinning, archiving, deletion, and voting
- Separate AI note weighting, so some notes can influence generation more than others
- Built-in prompt cards plus local AI generation through Ollama
- Adjustable AI divergence, from more focused to more exploratory
- AI model settings in the UI for Ollama model, base URL, generation count, and output language
- Streamed AI output with the final server prompt visible for debugging
- Undo for note deletion, note archiving, and import overwrite
- Undo for note creation, editing, movement, pinning, voting, color changes, AI weighting, board settings, and AI generation
- Adjustable note font size in the board UI
- Direct note editing without an edit mode button
- Filter and sort by scope, tag, keyword, recency, votes, and tag
- Export and import board data as JSON

## 本地部署和运行（给第一次使用的人）

这个项目可以完全在本地运行。网页本身由 Node.js 启动，AI 生成功能通过本机的 Ollama 模型完成；如果不配置 Ollama，普通白板、手动记笔记、导入导出等功能仍然可以用，但 AI 生成会不可用。

### 需要先安装的软件

1. 安装 Node.js

   建议安装 Node.js `20.19` 或更新版本。不会选版本的话，直接安装 Node.js 官网推荐的 LTS 版本即可。安装 Node.js 后会自带 `npm`，后面命令会用到它。

2. 安装 Ollama

   只有想使用 AI 生成想法时才必须安装。安装完成后，需要让 Ollama 在本机运行，并准备好一个模型。

3. 准备这个项目的代码

   如果你拿到的是压缩包，先解压。如果你用 Git，可以把仓库克隆到本地。

### 最简单的启动方式

打开终端或命令行，进入项目文件夹。确认你现在的位置里能看到 `package.json`。

```bash
cd /path/to/brainstorm
```

然后运行：

```bash
npm run quickstart
```

这个命令会自动做这些事：

- 检查 Node.js 版本是否合适
- 安装或更新项目依赖
- 如果本机装了 Ollama，检查它是否正在运行
- 如果缺少默认 AI 模型，询问是否下载
- 启动本地应用

启动成功后，终端会显示一个本地访问地址。通常是：

```text
http://localhost:5173
```

在浏览器里打开这个地址即可使用。

如果只想做安装和检查，但暂时不启动应用：

```bash
npm run setup
```

如果完全不需要 AI 功能，可以跳过 Ollama 检查：

```bash
npm run quickstart -- --no-ai
```

### 手动启动方式

打开终端或命令行，进入项目文件夹。确认你现在的位置里能看到 `package.json`。

```bash
cd /path/to/brainstorm
```

安装项目依赖：

```bash
npm install
```

如果你要使用 AI 功能，先启动 Ollama。Ollama 桌面版有时会自动在后台启动；如果没有，可以在一个单独的终端里运行：

```bash
ollama serve
```

再下载项目默认使用的模型：

```bash
ollama pull gemma4:e4b-it-q4_K_M
```

如果这个模型在你的机器上不可用，可以先用下面命令查看本机已有模型，然后在应用里的 **AI Settings** 里把模型名改成已有模型：

```bash
ollama list
```

回到项目终端，启动应用：

```bash
npm run dev
```

启动成功后，终端会显示一个本地访问地址。通常是：

```text
http://localhost:5173
```

在浏览器里打开这个地址即可使用。

### 日常再次启动

以后已经安装过依赖后，一般只需要：

```bash
npm run dev
```

如果要用 AI，确保 Ollama 正在运行，并且应用里的模型名和 `ollama list` 里看到的模型名一致。

### 常见问题

- `npm install` 或 `npm run dev` 提示找不到 `npm`：说明 Node.js 没有安装好，或者安装后终端没有重开。
- AI 按钮提示连接失败：确认 Ollama 正在运行，默认地址是 `http://127.0.0.1:11434`。
- AI 提示找不到模型：运行 `ollama list`，把里面真实存在的模型名填到应用的 **AI Settings**。
- 端口 `8787` 被占用：换一个 API 端口启动。

  macOS / Linux:

  ```bash
  PORT=8788 npm run dev
  ```

  Windows PowerShell:

  ```powershell
  $env:PORT=8788; npm run dev
  ```

### 本地生产模式

如果你不想用开发模式，而是想先打包再运行本地服务：

```bash
npm run build
npm run start
```

然后打开：

```text
http://127.0.0.1:8787
```

## Development

```bash
npm install
ollama serve
npm run dev
```

`npm run dev` starts both:

- The Vite frontend dev server
- A local Node API server, listening on `http://127.0.0.1:8787` by default

The frontend calls `/api/ai/ideas`, and that API server forwards requests to your local Ollama instance.

If port `8787` is already in use, start with another API port. The Vite dev proxy follows `PORT` automatically:

```bash
PORT=8788 npm run dev
```

## Ollama Configuration

The default model is `gemma4:e4b-it-q4_K_M`, assuming it already exists on your machine. You can change the Ollama model, base URL, generation count, and output language from the board UI through **AI Settings**.

Environment variables still provide the server defaults:

```bash
export OLLAMA_MODEL=gemma4:e4b-it-q4_K_M
export OLLAMA_BASE_URL=http://127.0.0.1:11434
npm run dev
```

By default the API only forwards Ollama requests to localhost, loopback, private network IPs, or `.local` hosts. To intentionally use a remote Ollama endpoint, opt in explicitly:

```bash
export ALLOW_REMOTE_OLLAMA=1
export OLLAMA_BASE_URL=https://your-ollama-host.example
npm run dev
```

You can also tune upstream request timeouts:

```bash
export OLLAMA_STATUS_TIMEOUT_MS=5000
export OLLAMA_GENERATION_TIMEOUT_MS=120000
```

## Production Mode

Build the frontend first, then run the local server to serve both the static site and the AI API:

```bash
npm run build
npm run start
```

## Verification

```bash
npm run test
npm run lint
npm run build
```

## Data Format

Boards are stored in the browser and exported as JSON using the same underlying structure, so they can be imported again later or reused for further processing.
