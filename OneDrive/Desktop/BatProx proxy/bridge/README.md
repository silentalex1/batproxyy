# BatProx code-request bridge

Runs on your PC, picks up the requests you send from **Admin Panel → Code request**, feeds them to
the Claude Code CLI inside this repo, then commits and pushes so Cloudflare rebuilds the site.

## One-time setup

1. Pick a long random password. This is your bridge token.

2. Put it on the worker:

```bash
npx wrangler secret put BRIDGE_TOKEN
```

3. Put the same value in your PC's environment, along with the repo path:

```bash
setx BATPROX_BRIDGE_TOKEN "your-long-random-token"
```

## Running it

```bash
npm run bridge
```

While it is running the Code request tab shows **your pc is connected** and every request you send
from the site is executed here. Close it and the tab shows **your pc is offline** — requests then
fall back to the Anthropic API directly (answer only, no file changes) if `ANTHROPIC_API_KEY` is set
as a worker secret.

## Settings

| Variable | Default | What it does |
| --- | --- | --- |
| `BATPROX_BRIDGE_TOKEN` | *(required)* | Must match the worker's `BRIDGE_TOKEN` secret |
| `BATPROX_API` | `https://api.stealthybat.org` | Worker to poll |
| `BATPROX_REPO` | the folder above `bridge/` | Repo the CLI runs in |
| `BATPROX_CLAUDE_CLI` | `claude` | Command used for the Claude option |
| `BATPROX_COPILOT_CLI` | `copilot` | Command used for the GitHub Copilot option |
| `BATPROX_CLI_ARGS` | `--permission-mode acceptEdits` | Extra flags passed to the CLI |
| `BATPROX_PUSH` | `1` | Set to `0` to review changes yourself instead of auto-pushing |
| `BATPROX_BRANCH` | `main` | Branch to push to |
| `BATPROX_POLL` | `5000` | Poll interval in ms |
| `BATPROX_TIMEOUT` | `900000` | Max ms a single request may run |

## Keeping it always on

So requests work while you are away, start it on boot — Task Scheduler on Windows with
"Run whether user is logged on or not", action `node`, arguments `bridge\batprox-bridge.js`,
"Start in" set to this repo folder.
