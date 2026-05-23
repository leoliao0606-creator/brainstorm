import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { setTimeout as delay } from 'node:timers/promises';

const args = new Set(process.argv.slice(2));
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const defaultModel = process.env.OLLAMA_MODEL ?? 'gemma4:e4b-it-q4_K_M';
const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434').replace(/\/+$/, '');
const skipInstall = args.has('--no-install');
const skipAi = args.has('--no-ai');
const setupOnly = args.has('--setup-only');
const assumeYes = args.has('--yes') || args.has('-y');
const children = new Set();

let shuttingDown = false;

function log(message = '') {
  console.log(`[quickstart] ${message}`);
}

function parseVersion(version) {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map((part) => Number(part));
  return { major, minor, patch };
}

function isSupportedNodeVersion(version) {
  const { major, minor, patch } = parseVersion(version);
  if (major === 20) return minor > 19 || (minor === 19 && patch >= 0);
  if (major === 22) return minor > 12 || (minor === 12 && patch >= 0);
  return major > 22;
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    env: process.env,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function commandExists(command, commandArgs = ['--version']) {
  const result = spawnSync(command, commandArgs, {
    stdio: 'ignore',
    env: process.env,
  });

  return !result.error && result.status === 0;
}

function spawnManaged(command, commandArgs) {
  const child = spawn(command, commandArgs, {
    stdio: 'inherit',
    env: process.env,
  });

  children.add(child);
  child.on('exit', () => {
    children.delete(child);
  });

  return child;
}

function stopChildren() {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
}

async function fetchOllamaTags() {
  const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
    signal: AbortSignal.timeout(1500),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned HTTP ${response.status}.`);
  }

  return response.json();
}

async function isOllamaReachable() {
  try {
    await fetchOllamaTags();
    return true;
  } catch {
    return false;
  }
}

async function waitForOllama() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await isOllamaReachable()) return true;
    await delay(500);
  }

  return false;
}

async function askYesNo(question, defaultYes = true) {
  if (assumeYes || !process.stdin.isTTY) return defaultYes;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultYes ? ' [Y/n] ' : ' [y/N] ';
  const answer = (await rl.question(`${question}${suffix}`)).trim().toLowerCase();
  rl.close();

  if (!answer) return defaultYes;
  return answer === 'y' || answer === 'yes';
}

async function prepareOllama() {
  if (skipAi) {
    log('跳过 Ollama 检查。');
    return;
  }

  if (!commandExists('ollama')) {
    log('没有找到 Ollama。AI 生成功能暂时不可用；安装 Ollama 后可以重新运行这个命令。');
    return;
  }

  if (!(await isOllamaReachable())) {
    log('Ollama 没有运行，正在尝试启动 `ollama serve`...');
    spawnManaged('ollama', ['serve']);

    if (!(await waitForOllama())) {
      log(`无法连接 Ollama：${ollamaBaseUrl}。应用仍会启动，但 AI 生成功能暂时不可用。`);
      return;
    }
  }

  let installedModels = [];
  try {
    const tags = await fetchOllamaTags();
    installedModels = Array.isArray(tags.models)
      ? tags.models.map((model) => model.name).filter(Boolean)
      : [];
  } catch {
    log('无法读取 Ollama 模型列表。应用仍会启动，但 AI 设置可能需要手动检查。');
    return;
  }

  if (installedModels.includes(defaultModel)) {
    log(`Ollama 已就绪，模型已存在：${defaultModel}`);
    return;
  }

  log(`没有找到默认模型：${defaultModel}`);
  if (installedModels.length) {
    log(`本机已有模型：${installedModels.join(', ')}`);
  }

  const shouldPull = await askYesNo('是否现在下载默认模型？这个过程可能需要几分钟到更久。', true);
  if (!shouldPull) {
    log('已跳过模型下载。之后可以在应用里的 AI Settings 填写本机已有模型名。');
    return;
  }

  log(`开始下载模型：${defaultModel}`);
  run('ollama', ['pull', defaultModel]);
}

function checkNodeVersion() {
  const version = process.versions.node;
  if (isSupportedNodeVersion(version)) return;

  console.error(
    [
      `当前 Node.js 版本是 ${version}，这个项目需要 Node.js 20.19 或更新的兼容版本。`,
      '请安装 Node.js LTS 后，重新打开终端再运行这个命令。',
    ].join('\n')
  );
  process.exit(1);
}

async function main() {
  checkNodeVersion();

  if (!skipInstall) {
    log('安装或更新项目依赖...');
    run(npmCommand, ['install']);
  }

  await prepareOllama();

  if (setupOnly) {
    log('准备完成。之后运行 `npm run dev` 或 `npm run quickstart` 即可启动应用。');
    return;
  }

  log('启动本地应用...');
  const app = spawnManaged(npmCommand, ['run', 'dev']);

  app.on('exit', (code) => {
    stopChildren();
    process.exit(code ?? 0);
  });
}

process.on('SIGINT', () => {
  stopChildren();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopChildren();
  process.exit(0);
});

main().catch((error) => {
  stopChildren();
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
