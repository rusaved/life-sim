// `npm run verify`: цепочка проверок, каждая с именем и временем.
//   --fast   типы + unit + проверка контента + бот жизней: после каждой задачи, бюджет 5 минут.
//   (без флага) всё, включая сборки, проверку vk/ и e2e: один раз в итоге вехи (плюс один повтор).
// Полный вывод — в .cache/verify.log, в консоль — строки этапов и хвост упавшего этапа.
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const fast = process.argv.includes('--fast');
const FAST_BUDGET_SEC = 300;
const TAIL = 40;
const STAGES = [
  { name: 'typecheck', fast: true },
  { name: 'test', fast: true },
  { name: 'validate:content', fast: true },
  { name: 'sim:lives', fast: true },
  { name: 'build:pages' },
  { name: 'check:vk' },
  { name: 'e2e' },
];
const stages = STAGES.filter((s) => !fast || s.fast);
mkdirSync(resolve(root, '.cache'), { recursive: true });
const log = createWriteStream(resolve(root, '.cache/verify.log'));
const say = (line) => {
  console.log(line);
  log.write(line + '\n');
};

const run = (name) =>
  new Promise((done) => {
    const tail = [];
    const push = (chunk) => {
      log.write(chunk);
      for (const line of chunk.toString().split('\n')) {
        tail.push(line);
        if (tail.length > TAIL) tail.shift();
      }
    };
    const child = spawn('npm', ['run', '--silent', name], { cwd: root, env: process.env, shell: process.platform === 'win32' });
    child.stdout.on('data', push);
    child.stderr.on('data', push);
    child.on('close', (code) => done({ code: code ?? 1, tail }));
  });

const started = Date.now();
say(`verify (${fast ? 'fast' : 'веха'}): ${stages.length} этапов, полный лог .cache/verify.log`);
for (const s of stages) {
  log.write(`\n== ${s.name}\n`);
  const t0 = Date.now();
  const { code, tail } = await run(s.name);
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  if (code !== 0) {
    say(`FAIL ${s.name} за ${sec} с (код ${code})`);
    console.log(tail.join('\n'));
    log.end(() => process.exit(code));
    await new Promise(() => {});
  }
  say(`ok   ${s.name} ${sec} с`);
}
const total = Math.round((Date.now() - started) / 1000);
say(`verify: все ${stages.length} этапов зелёные за ${total} с`);
if (fast && total > FAST_BUDGET_SEC) say(`verify:fast шёл ${total} с при бюджете ${FAST_BUDGET_SEC} с — записать в progress.md`);
log.end();
