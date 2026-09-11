const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const API = (process.env.BATPROX_API || 'https://api.stealthybat.org').replace(/\/$/, '');
const TOKEN = process.env.BATPROX_BRIDGE_TOKEN || '';
const REPO = process.env.BATPROX_REPO || path.resolve(__dirname, '..');
const CLAUDE_CLI = process.env.BATPROX_CLAUDE_CLI || 'claude';
const COPILOT_CLI = process.env.BATPROX_COPILOT_CLI || 'copilot';
const CLI_ARGS = (process.env.BATPROX_CLI_ARGS || '--permission-mode acceptEdits').split(' ').filter(Boolean);
const BRANCH = process.env.BATPROX_BRANCH || 'main';
const PUSH = process.env.BATPROX_PUSH !== '0';
const POLL = Math.max(2000, Number(process.env.BATPROX_POLL || 5000));
const TIMEOUT = Math.max(60000, Number(process.env.BATPROX_TIMEOUT || 900000));
const HOST = os.hostname();

if (!TOKEN) {
  console.error('BATPROX_BRIDGE_TOKEN is not set. Use the same value as the BRIDGE_TOKEN secret on the worker.');
  process.exit(1);
}

const headers = { 'x-bridge-token': TOKEN, 'x-bridge-host': HOST, 'Content-Type': 'application/json' };

function run(cmd, args, input, useShell) {
  return new Promise(resolve => {
    let child;
    try {
      child = spawn(cmd, args, { cwd: REPO, shell: !!useShell, windowsHide: true });
    } catch (e) {
      resolve({ code: 1, out: '', err: e.message });
      return;
    }
    let out = '';
    let err = '';
    let killed = false;
    const timer = setTimeout(() => { killed = true; try { child.kill(); } catch {} }, TIMEOUT);
    child.stdout.on('data', d => { out += d.toString(); });
    child.stderr.on('data', d => { err += d.toString(); });
    child.on('error', e => { clearTimeout(timer); resolve({ code: 1, out, err: err || e.message }); });
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ code: killed ? 124 : code, out, err: killed ? err + '\ntimed out after ' + Math.round(TIMEOUT / 1000) + 's' : err });
    });
    if (input !== undefined && child.stdin) {
      child.stdin.on('error', () => {});
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

async function publish(job) {
  const status = await run('git', ['status', '--porcelain']);
  if (status.code !== 0) return 'git status failed: ' + (status.err || '').trim();
  if (!status.out.trim()) return 'No file changes, nothing to push.';
  const add = await run('git', ['add', '-A']);
  if (add.code !== 0) return 'git add failed: ' + (add.err || '').trim();
  const msg = 'code request: ' + job.prompt.replace(/\s+/g, ' ').slice(0, 60);
  const commit = await run('git', ['commit', '-m', msg]);
  if (commit.code !== 0) return 'git commit failed: ' + (commit.err || commit.out || '').trim();
  const push = await run('git', ['push', 'origin', BRANCH]);
  if (push.code !== 0) return 'git push failed: ' + (push.err || '').trim();
  return 'Pushed to ' + BRANCH + '. Cloudflare will rebuild the site in a minute.';
}

async function handle(job) {
  const cli = job.provider === 'copilot' ? COPILOT_CLI : CLAUDE_CLI;
  const r = await run(cli, ['-p'].concat(CLI_ARGS), job.prompt, true);
  const text = (r.out || '').trim();
  const stderr = (r.err || '').trim();
  if (!text && r.code !== 0) return { id: job.id, error: cli + ' exited with code ' + r.code + (stderr ? '\n' + stderr : '') };
  let reply = text || stderr || 'The CLI returned no output.';
  if (PUSH) reply += '\n\n---\n' + await publish(job);
  return { id: job.id, reply };
}

async function tick() {
  let data;
  try {
    const r = await fetch(API + '/api/bridge/jobs', { headers });
    data = await r.json();
  } catch (e) {
    console.log('[bridge] poll failed:', e.message);
    return;
  }
  if (!data || !data.success) {
    console.log('[bridge]', (data && data.error) || 'the worker rejected this bridge');
    return;
  }
  for (const job of data.jobs || []) {
    console.log('[bridge] running ' + job.id + ' (' + job.provider + ') from ' + (job.user || 'admin'));
    let result;
    try {
      result = await handle(job);
    } catch (e) {
      result = { id: job.id, error: e.message || 'bridge failure' };
    }
    try {
      await fetch(API + '/api/bridge/result', { method: 'POST', headers, body: JSON.stringify(result) });
      console.log('[bridge] finished ' + job.id);
    } catch (e) {
      console.log('[bridge] could not send the result back:', e.message);
    }
  }
}

let closing = false;

async function goOffline() {
  if (closing) return;
  closing = true;
  try {
    await fetch(API + '/api/bridge/ping', { method: 'POST', headers, body: JSON.stringify({ down: true }) });
    console.log('[bridge] marked offline');
  } catch {}
  process.exit(0);
}

process.on('SIGINT', goOffline);
process.on('SIGTERM', goOffline);
process.on('SIGHUP', goOffline);

(async () => {
  console.log('[bridge] ' + HOST + ' -> ' + API);
  console.log('[bridge] repo: ' + REPO);
  console.log('[bridge] auto push: ' + (PUSH ? 'on (' + BRANCH + ')' : 'off'));
  while (!closing) {
    await tick();
    await new Promise(r => setTimeout(r, POLL));
  }
})();
