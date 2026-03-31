# Sunday School v2

Sunday School v2 is a football pool application built as a split system:

- An ESPN polling service runs on a home server and watches NFL schedule and score changes.
- The web app and backend infrastructure run in AWS using SST.

The current implementation already has a working ESPN ingest pipeline and a usable frontend shell that shows the intended pool flow. The frontend is still using in-memory mock data, so it is not yet connected to the deployed backend data model.

## What The App Does

The app is centered around weekly football pool picks.

- Players pick winners for each matchup.
- Some games are ranked by confidence.
- Some games are filed as unranked bonus picks.
- Results pages compare submitted picks against final game outcomes and calculate points.

Today, that full experience exists in the frontend as mocked application behavior, while the backend work that is live is focused on ingesting and storing ESPN game data.

## Architecture Overview

### 1. ESPN service on the home server

The Python service in `ESPN/` polls ESPN for:

- season schedule changes
- live game status updates
- final scores

It keeps local state in SQLite (`nfl_state.db`) and sends signed webhook payloads to AWS when schedule data changes or games become final.

Key files:

- `ESPN/nfl_monitor.py`: long-running monitor and backfill entry point
- `ESPN/espn_client.py`: ESPN API client
- `ESPN/nfl_state.db`: local service state

### 2. AWS backend with SST

The SST app provisions:

- a Cognito user pool and identity pool for frontend auth
- a DynamoDB table for ESPN game data
- an internal API route for ESPN ingest
- a static site for the frontend

The deployed ingest route is:

- `POST /internal/espn-ingest`

That route:

- verifies an HMAC signature
- validates the payload with Zod
- writes ESPN schedule and final score data into DynamoDB

Key files:

- `sst.config.ts`: infrastructure definition
- `functions/espn-ingest.ts`: ingest Lambda handler
- `functions/lib/auth.ts`: webhook signature verification
- `functions/lib/dynamo.ts`: DynamoDB write helpers
- `functions/lib/espn-schemas.ts`: webhook payload schemas

### 3. Frontend

The frontend is a Vite + React + TypeScript app using Mantine, React Router, React Query, and AWS Amplify for Cognito authentication.

Main user-facing areas:

- `Home`
- `Submit Picks`
- `Results`
- `Admin`
- `Settings`

Important current note:

- The frontend is not connected to the backend yet.
- The data in `src/app/API/functions.ts` is mock data stored in memory.
- That mock layer shows the intended shape of lineups, submissions, results, and scoring.

## Current State

This repository is still under construction.

- The ESPN polling and ingest pipeline is the most complete part of the system.
- The frontend shows the intended user flow for weekly picks and results.
- The backend data ingest path exists, but the frontend has not been wired to consume it yet.
- Admin functionality is only lightly scaffolded right now.

## Repository Layout

```text
.
├── ESPN/                  # Python monitor service for ESPN polling and webhook delivery
├── functions/             # SST Lambda handlers, schemas, auth, and tests
├── src/                   # React frontend
├── infra/                 # Additional infrastructure work area
├── sst.config.ts          # Main SST stack
├── package.json           # Node scripts
└── vitest.config.ts       # Backend test configuration
```

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
npx sst secret set EspnWebhookSecret "<secret>" --stage develop1
```

Use the same secret value in the ESPN service environment as `NFL_WEBHOOK_SECRET`.

### 5. Deploy or start the SST app

For local SST development:

```bash
npm run dev -- --stage develop1
```

For a real deployment:

```bash
npm run deploy -- --stage develop1
```

After deployment, note the `IngestApiUrl` output. The ESPN service should post to:

```text
<IngestApiUrl>/internal/espn-ingest
```

### 6. Configure the ESPN service environment

The ESPN service needs these environment variables:

- `NFL_WEBHOOK_SECRET`: the same value stored in SST as `EspnWebhookSecret`
- `NFL_NOTIFY_URL`: the deployed ingest URL, for example `https://.../internal/espn-ingest`

Example:

```bash
export NFL_WEBHOOK_SECRET="<secret>"
export NFL_NOTIFY_URL="<IngestApiUrl>/internal/espn-ingest"
```

If you keep these values in a local env file for the ESPN service, make sure they are loaded into the process environment before starting `ESPN/nfl_monitor.py`.

### 7. Cognito values for the frontend

The frontend uses these variables:

- `VITE_USER_POOL_ID`
- `VITE_USER_POOL_CLIENT_ID`
- `VITE_IDENTITY_POOL_ID`

When you run through SST, those values are injected by the stack configuration in `sst.config.ts`.

## Running The App

### Frontend and SST

Run the app in SST dev mode:

```bash
npm run dev -- --stage develop1
```

This starts the SST app and serves the frontend with Vite.

### Frontend production build

```bash
npm run build
```

Preview the built frontend locally:

```bash
npm run preview
```

### ESPN monitor service

Run the long-lived monitor:

```bash
python ESPN/nfl_monitor.py
```

Or run it from inside the `ESPN/` directory:

```bash
cd ESPN
python nfl_monitor.py
```

### Historical backfill

Backfill a single year:

```bash
python ESPN/nfl_monitor.py 2024
```

Backfill a year range:

```bash
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
npm run remove -- --stage develop1
```

## How The Pieces Fit Together

The implemented backend flow looks like this:

1. `ESPN/nfl_monitor.py` polls ESPN on the home server.
2. When schedule data changes or a game finishes, it sends a signed webhook request.
3. The SST API route `POST /internal/espn-ingest` verifies the signature.
4. The Lambda validates the payload and writes game records to DynamoDB.

The intended full application flow looks like this:

1. ESPN data lands in DynamoDB through the ingest pipeline.
2. Backend APIs expose weekly lineups, picks, results, and admin workflows.
3. The React frontend consumes those APIs instead of mock data.
4. Users authenticate with Cognito and submit/view picks through the web app.

## Notes For Future Development

- `src/app/API/functions.ts` is the temporary mock data layer.
- Submissions in the frontend are currently stored only in memory and reset on reload.
- The results view is also driven by mock data.
- The admin page is still a placeholder.
- `functions/lib/admin-auth.ts` outlines planned Cognito JWT-based admin auth, but that path is not fully wired yet.

## License

No license has been added to this repository yet.
