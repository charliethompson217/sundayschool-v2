# NFL Score Monitor

A long-running Python service that polls the ESPN API for NFL game schedules and live scores, then pushes updates to the Sunday School webhook.

## How it works

```
ESPN public API
      │
      ▼
 espn_client.py   ← thin HTTP + parsing layer
      │
      ▼
 nfl_monitor.py   ← state machine + scheduler
      │  SQLite (nfl_state.db)
      ▼
 POST /internal/espn-ingest   ← Sunday School Lambda webhook
```

On each loop cycle the monitor:

1. Refreshes the NFL schedule for the current season (once every 24 h by default).
2. Polls any games whose `next_poll_at` timestamp has passed — concurrently, up to `NFL_POLL_WORKERS` at a time.
3. Flushes the outbox: sends any games with unsent schedule or final data to the webhook.
4. Persists state to SQLite.
5. Sleeps until the next due poll or schedule refresh.

Dirty flags (`schedule_dirty`, `final_dirty`) ensure a game is **never silently dropped** — if a webhook send fails the flags remain set and the game is retried on the next flush cycle.

## Files

| File                  | Purpose                                                    |
| --------------------- | ---------------------------------------------------------- |
| `nfl_monitor.py`      | Main service — polling loop, state machine, outbox         |
| `espn_client.py`      | ESPN API client (`APIError`, `ParsingError`)               |
| `webhook_logger.py`   | Local dev server that prints incoming webhook payloads     |
| `requirements.txt`    | Python dependencies                                        |
| `.env.dev`            | Dev environment variables (do **not** commit real secrets) |
| `nfl-monitor.service` | Example systemd unit file for running the service on Linux |

## Setup

```bash
cd ESPN
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Copy `.env.example` and fill in your values:

```bash
cp .env.example .env
```

## Running

### Live service (continuous polling)

```bash
source venv/bin/activate
set -a && source .env && set +a
python nfl_monitor.py
```

### Historical backfill

Backfills a single year or an inclusive range, then exits:

```bash
python nfl_monitor.py 2024
python nfl_monitor.py 2020-2024
```

### Local webhook logging (dev)

In one terminal, start the logger:

```bash
python webhook_logger.py 8765
```

In another, point the monitor at it:

```bash
NFL_NOTIFY_URL=http://localhost:8765 python nfl_monitor.py
```

Payloads are printed to stdout and appended to `webhook.log`.

## Running as a systemd service

Use systemd to run the monitor as a persistent background service that starts on boot, restarts on failure, and logs to the system journal.

### 1. Create a dedicated user (recommended)

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin nfl-monitor
```

### 2. Choose a deployment directory

Copy (or clone) the `ESPN/` directory to a stable path on the server. A typical choice:

```bash
sudo mkdir -p /opt/nfl-monitor
sudo cp -r . /opt/nfl-monitor/
sudo chown -R nfl-monitor:nfl-monitor /opt/nfl-monitor
```

Create the virtual environment as the service user:

```bash
sudo -u nfl-monitor python3 -m venv /opt/nfl-monitor/venv
sudo -u nfl-monitor /opt/nfl-monitor/venv/bin/pip install -r /opt/nfl-monitor/requirements.txt
```

### 3. Create the environment file

Copy the example and fill in real values. This file **must not be world-readable** because it contains the webhook secret.

```bash
sudo cp /opt/nfl-monitor/.env.example /opt/nfl-monitor/.env
sudo chown nfl-monitor:nfl-monitor /opt/nfl-monitor/.env
sudo chmod 600 /opt/nfl-monitor/.env
# Edit /opt/nfl-monitor/.env and set NFL_NOTIFY_URL, NFL_WEBHOOK_SECRET, etc.
```

### 4. Install the unit file

An example unit file is provided at `nfl-monitor.service`. Copy it to the systemd directory and reload the daemon:

```bash
sudo cp /opt/nfl-monitor/nfl-monitor.service /etc/systemd/system/
sudo systemctl daemon-reload
```

### 5. Enable and start the service

```bash
sudo systemctl enable nfl-monitor   # start automatically on boot
sudo systemctl start  nfl-monitor
sudo systemctl status nfl-monitor   # verify it is running
```

### 6. Viewing logs

```bash
# Follow live output
sudo journalctl -u nfl-monitor -f

# Last 200 lines
sudo journalctl -u nfl-monitor -n 200

# Since a specific time
sudo journalctl -u nfl-monitor --since "2025-09-08 00:00:00"
```

### Updating the service

```bash
# Pull new code, reinstall deps if requirements.txt changed
sudo -u nfl-monitor /opt/nfl-monitor/venv/bin/pip install -r /opt/nfl-monitor/requirements.txt
sudo systemctl restart nfl-monitor
```

---

## Environment variables

All variables have sensible defaults and can be overridden at runtime.

### Required

| Variable             | Description                                       |
| -------------------- | ------------------------------------------------- |
| `NFL_NOTIFY_URL`     | Webhook URL to POST game events to                |
| `NFL_WEBHOOK_SECRET` | HMAC-SHA256 signing secret shared with the Lambda |

### Tuning

| Variable                    | Default        | Description                                            |
| --------------------------- | -------------- | ------------------------------------------------------ |
| `NFL_LOG_LEVEL`             | `INFO`         | Python log level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `NFL_DB_FILE`               | `nfl_state.db` | SQLite database path                                   |
| `NFL_HTTP_TIMEOUT_SECS`     | `10`           | Per-request HTTP timeout                               |
| `NFL_SCHEDULE_REFRESH_SECS` | `86400`        | How often to re-fetch the full schedule (24 h)         |
| `NFL_MAX_IDLE_SLEEP_SECS`   | `1800`         | Maximum sleep between loop cycles                      |
| `NFL_POLL_WORKERS`          | `4`            | Concurrent ESPN API poll threads                       |
| `NFL_MAX_POLLS_PER_CYCLE`   | `12`           | Cap on games polled per loop iteration                 |
| `NFL_POLL_JITTER_SECS`      | `2`            | Random jitter added to poll intervals                  |

### Poll intervals

| Variable                          | Default | Trigger                                         |
| --------------------------------- | ------- | ----------------------------------------------- |
| `NFL_PRE_KICKOFF_WATCH_SECS`      | `1800`  | Window before kickoff to start watching         |
| `NFL_PRE_KICKOFF_POLL_SECS`       | `600`   | Poll rate in that pre-kickoff window            |
| `NFL_PRE_KICKOFF_NEAR_SECS`       | `300`   | "Near kickoff" threshold                        |
| `NFL_PRE_KICKOFF_NEAR_POLL_SECS`  | `120`   | Poll rate when near kickoff                     |
| `NFL_IN_PROGRESS_POLL_SECS`       | `300`   | Default in-game poll rate                       |
| `NFL_HALFTIME_POLL_SECS`          | `180`   | Poll rate at halftime                           |
| `NFL_LATE_GAME_POLL_SECS`         | `120`   | Poll rate in the 4th quarter (not final window) |
| `NFL_FINAL_WINDOW_POLL_SECS`      | `30`    | Poll rate when Q4 clock ≤ 5 min                 |
| `NFL_OT_POLL_SECS`                | `60`    | Overtime poll rate                              |
| `NFL_OT_FINAL_WINDOW_POLL_SECS`   | `20`    | Poll rate when OT clock ≤ 5 min                 |
| `NFL_PAST_EXPECTED_END_POLL_SECS` | `30`    | Poll rate once expected end time has passed     |
| `NFL_EXPECTED_GAME_DURATION_SECS` | `12000` | Expected game length (3 h 20 min)               |
| `NFL_EXPECTED_END_TIGHTEN_SECS`   | `900`   | Tighten polling 15 min before expected end      |

### Webhook retry / backoff

| Variable                             | Default | Description                                                    |
| ------------------------------------ | ------- | -------------------------------------------------------------- |
| `NFL_MAX_WEBHOOK_RETRIES`            | `5`     | Consecutive failures before a CRITICAL alert is logged         |
| `NFL_WEBHOOK_BACKOFF_BASE_SECS`      | `30`    | Initial retry delay; doubles each attempt                      |
| `NFL_WEBHOOK_BACKOFF_MAX_SECS`       | `1800`  | Maximum retry delay (30 min)                                   |
| `NFL_WEBHOOK_PERMANENT_BACKOFF_SECS` | `14400` | Backoff after a permanent error (4xx) before retrying (4 h)    |
| `NFL_WEBHOOK_BATCH_SIZE`             | `50`    | prevents any single HTTP request from carrying too many games. |
| `WEBHOOK_TIMEOUT_SECS`               | `60`    | Per-request HTTP timeout                                       |

## Webhook events

The monitor sends two event types to `NFL_NOTIFY_URL`.

### `schedule_upsert`

Sent whenever a new game is discovered or schedule details change (time, venue, teams). Safe to replay — the Lambda performs an idempotent upsert.

```json
{
  "type": "schedule_upsert",
  "sent_at": "2024-09-08T17:00:00Z",
  "games": [
    {
      "game_id": "401671793",
      "competition_id": "401671793",
      "year": "2024",
      "season_type": "2",
      "week": "1",
      "week_text": "Week 1",
      "start_time": "2024-09-08T17:00Z",
      "home_team_id": "12",
      "away_team_id": "33",
      "home": "Kansas City Chiefs",
      "away": "Baltimore Ravens",
      "competition_type": "Standard",
      "competition_type_slug": "standard",
      "neutral_site": false,
      "venue_id": "3612",
      "venue_full_name": "GEHA Field at Arrowhead Stadium",
      "venue_city": "Kansas City",
      "venue_state": "MO",
      "venue_country": "USA"
    }
  ]
}
```

### `game_final`

Sent once a game is marked completed by the ESPN API. Also safe to replay.

```json
{
  "type": "game_final",
  "sent_at": "2024-09-08T23:45:00Z",
  "games": [
    {
      "game_id": "401671793",
      "competition_id": "401671793",
      "year": "2024",
      "season_type": "2",
      "week": "1",
      "week_text": "Week 1",
      "start_time": "2024-09-08T17:00Z",
      "home_team_id": "12",
      "away_team_id": "33",
      "home": "Kansas City Chiefs",
      "away": "Baltimore Ravens",
      "home_score": 27,
      "away_score": 20,
      "status": "STATUS_FINAL",
      "completed": true,
      "winner": "home"
    }
  ]
}
```

## Request signing

Every POST is signed with HMAC-SHA256 over `{timestamp}.{body}` using `NFL_WEBHOOK_SECRET`. The Lambda verifies this before processing.

```
X-SS-Timestamp: 1725811200
X-SS-Signature: <hex digest>
```

## Error handling and retries

If a webhook send fails, affected games **remain dirty** and are retried on the next flush cycle. The retry behaviour depends on the HTTP status:

- **5xx / 429 / network error** — transient; exponential backoff starting at `WEBHOOK_BACKOFF_BASE_SECS`, capped at `WEBHOOK_BACKOFF_MAX_SECS`.
- **4xx (auth / validation error)** — permanent; long backoff (`WEBHOOK_PERMANENT_BACKOFF_SECS`) because retrying with the same payload will not succeed until the underlying config or code issue is fixed.
- After `MAX_WEBHOOK_RETRIES` consecutive failures a `CRITICAL` log is emitted to alert the operator.
- On any successful send the consecutive-failure counter resets and a recovery message is logged.
