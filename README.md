# Brainstorm Studio

一个适合工作坊、需求讨论和创意会的头脑风暴板。现在这不是 Vite 默认模板，而是一页可直接使用的 React 应用。

## 功能

- 本地自动保存到 `localStorage`
- 跨浏览器标签页同步同一块工作板
- 手动录入卡片，支持标签、编辑、投票、置顶、归档、删除
- 内置「题卡 + AI 辅助」，可通过本地 Ollama 上的 Gemma 模型补 5 张热身卡
- 按作用域、标签、关键词筛选，支持按最近更新时间、票数、标签排序
- 导出 / 导入 JSON，方便在会前准备和不同设备之间搬运

## 开发

```bash
npm install
ollama serve
npm run dev
```

`npm run dev` 会同时启动：

- Vite 前端开发服务器
- 本地 Node API 层，默认监听 `http://127.0.0.1:8787`

前端通过 `/api/ai/ideas` 调用这个 API，再由 API 请求本机的 Ollama。

## Ollama 配置

默认模型是当前机器上已存在的 `gemma4:e4b-it-q4_K_M`。如果你想改模型或地址，可以在启动前设置环境变量：

```bash
export OLLAMA_MODEL=gemma4:e4b-it-q4_K_M
export OLLAMA_BASE_URL=http://127.0.0.1:11434
npm run dev
```

生产模式可先构建，再让本地服务同时提供静态页面和 AI API：

```bash
npm run build
npm run start
```

## 验证

```bash
npm run lint
npm run build
```

## 数据格式

工作板会自动保存到浏览器本地，键名为 `brainstorm:studio:v2`。导出的 JSON 也沿用同一结构，便于再次导入或做二次处理。
