# Sunday School v2

Sunday School v2 is a football pool application built as a split system:

- An ESPN polling service that runs on a separate server and watches NFL schedule and score changes.
- The web app and backend infrastructure run in AWS.

The ESPN polling service is mostly complete. The web app has a working ESPN ingest pipeline and a frontend shell showing the intended pool flow, but it still uses in-memory mock data and is not yet connected to the backend. Auth and user infrastructure are already in place.

## What The App Does

The app is centered around weekly football pool picks.

- Players pick winners for each matchup.
- Some games are ranked by confidence.
- Some games are filed as unranked bonus picks.

## Architecture Overview

### ESPN service

The Python service in `ESPN/` polls ESPN for:

- season schedule changes
- live game status updates
- final scores

It keeps local state in SQLite (`nfl_state.db`) and sends signed webhook payloads to AWS when schedule data changes or games become final.

### AWS backend with SST

SST provisions:

- a Cognito user pool and identity pool for frontend auth
- DynamoDB tables for ESPN game data, pool schedules and configurations, user points, and user metadata
- an internal API for ESPN ingest
- an API for the web client
- a static site for the frontend

The ingest route verifies an HMAC signature, validates the payload with Zod, and writes ESPN schedule and final score data into DynamoDB.

### Frontend

The frontend is a Vite + React + TypeScript app using Mantine, React Router, React Query, and AWS Amplify for Cognito authentication.

Main user-facing areas:

- `Home`
- `Submit Picks`
- `Results`
- `Admin`
- `Settings`

## Prerequisites

- Node.js and npm
- Python 3
- AWS credentials configured locally
- SST CLI access through `npx sst`

## Setup

### 1. Install Node dependencies

```bash
npm install
```

### 2. Install Python dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r ESPN/requirements.txt
```

### 3. Git hooks

This repo is configured with `simple-git-hooks` and `lint-staged`.

On commit, the pre-commit hook runs:

- `prettier --write`
- `eslint --fix`

against staged `js`, `jsx`, `ts`, `tsx`, `json`, `css`, and `md` files.

If you need to install or refresh the local git hooks manually, run:

```bash
npx simple-git-hooks
```

### 4. Configure the SST secret

Set the shared secret used by the ingest Lambda:

```bash
npx sst secret set EspnWebhookSecret "<secret>" --stage <stage_name>
```

Use the same secret value in the ESPN service environment as `NFL_WEBHOOK_SECRET`.

### 5. Deploy the SST app

```bash
npm run deploy -- --stage <stage_name>
```

After deployment, note the `IngestApiUrl` output.

### 6. Configure the ESPN service environment

The ESPN service needs these environment variables:

- `NFL_WEBHOOK_SECRET`: the same value stored in SST as `EspnWebhookSecret`
- `NFL_NOTIFY_URL`: the deployed ingest URL (`<IngestApiUrl>/internal/espn-ingest`)

Make sure these are loaded into the process environment before starting `ESPN/nfl_monitor.py`.

### 7. Cognito values for the frontend

The frontend uses these variables:

- `VITE_USER_POOL_ID`
- `VITE_USER_POOL_CLIENT_ID`
- `VITE_IDENTITY_POOL_ID`

When you run through SST, those values are injected by the stack configuration in `sst.config.ts`.

## Running The App

### Frontend and SST dev mode

```bash
npm run dev -- --stage <stage_name>
```

This starts the SST app and serves the frontend with Vite. Lamda requests are forwarded to your dev machine from AWS.

### ESPN monitor service

```bash
python ESPN/nfl_monitor.py
```

Pass a year or range to backfill historical data:

```bash
python ESPN/nfl_monitor.py 2024
python ESPN/nfl_monitor.py 2020-2025
```

## Running Tests

Backend tests use Vitest and currently cover the ingest/auth/schema/DynamoDB helpers under `functions/`.

Run all tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## Useful Commands

Lint:

```bash
npm run lint
```

Format frontend TypeScript files:

```bash
npm run format
```

Remove the deployed SST stack:

```bash
npm run remove -- --stage <stage_name>
```

## License

MIT
