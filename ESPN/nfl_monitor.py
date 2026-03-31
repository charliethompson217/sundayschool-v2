#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import hmac as _hmac
import json
import logging
import os
import random
import re
import signal
import sqlite3
import sys
import time
from concurrent.futures import Future, ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import requests as _requests

from espn_client import APIError, EspnClient, ParsingError


DB_FILE = os.environ.get("NFL_DB_FILE", "nfl_state.db")
NOTIFY_URL = os.environ.get("NFL_NOTIFY_URL", "")
WEBHOOK_SECRET = os.environ.get("NFL_WEBHOOK_SECRET", "")

HTTP_TIMEOUT_SECS = int(os.environ.get("NFL_HTTP_TIMEOUT_SECS", 10))
SCHEDULE_REFRESH_SECS = int(os.environ.get("NFL_SCHEDULE_REFRESH_SECS", 24 * 3600))
MAX_IDLE_SLEEP_SECS = int(os.environ.get("NFL_MAX_IDLE_SLEEP_SECS", 1800))

POLL_WORKERS = int(os.environ.get("NFL_POLL_WORKERS", 4))
MAX_POLLS_PER_CYCLE = int(os.environ.get("NFL_MAX_POLLS_PER_CYCLE", 12))
POLL_JITTER_SECS = int(os.environ.get("NFL_POLL_JITTER_SECS", 2))

PRE_KICKOFF_WATCH_SECS = int(os.environ.get("NFL_PRE_KICKOFF_WATCH_SECS", 30 * 60))
PRE_KICKOFF_POLL_SECS = int(os.environ.get("NFL_PRE_KICKOFF_POLL_SECS", 10 * 60))
PRE_KICKOFF_NEAR_SECS = int(os.environ.get("NFL_PRE_KICKOFF_NEAR_SECS", 5 * 60))
PRE_KICKOFF_NEAR_POLL_SECS = int(os.environ.get("NFL_PRE_KICKOFF_NEAR_POLL_SECS", 120))

IN_PROGRESS_POLL_SECS = int(os.environ.get("NFL_IN_PROGRESS_POLL_SECS", 300))
HALFTIME_POLL_SECS = int(os.environ.get("NFL_HALFTIME_POLL_SECS", 180))
LATE_GAME_POLL_SECS = int(os.environ.get("NFL_LATE_GAME_POLL_SECS", 120))
FINAL_WINDOW_POLL_SECS = int(os.environ.get("NFL_FINAL_WINDOW_POLL_SECS", 30))
OT_POLL_SECS = int(os.environ.get("NFL_OT_POLL_SECS", 60))
OT_FINAL_WINDOW_POLL_SECS = int(os.environ.get("NFL_OT_FINAL_WINDOW_POLL_SECS", 20))

EXPECTED_GAME_DURATION_SECS = int(
    os.environ.get("NFL_EXPECTED_GAME_DURATION_SECS", 3 * 3600 + 20 * 60)
)
EXPECTED_END_TIGHTEN_SECS = int(os.environ.get("NFL_EXPECTED_END_TIGHTEN_SECS", 15 * 60))
PAST_EXPECTED_END_POLL_SECS = int(os.environ.get("NFL_PAST_EXPECTED_END_POLL_SECS", 30))

SEASON_TYPES = ["1", "2", "3"]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
    stream=sys.stdout,
)
log = logging.getLogger("nfl_monitor")

_shutdown = False


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _sha256_obj(obj: Dict) -> str:
    payload = json.dumps(obj, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _parse_iso(iso: str) -> float:
    clean = iso.rstrip("Z")
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"):
        try:
            return datetime.strptime(clean, fmt).replace(tzinfo=timezone.utc).timestamp()
        except ValueError:
            continue
    log.warning(f"Could not parse timestamp: '{iso}'")
    return 0.0


def _parse_years_arg(arg: str) -> List[str]:
    m = re.fullmatch(r"(\d{4})-(\d{4})", arg)
    if m:
        start, end = int(m.group(1)), int(m.group(2))
        if start > end:
            raise argparse.ArgumentTypeError(f"Year range start ({start}) must be ≤ end ({end})")
        return [str(y) for y in range(start, end + 1)]

    if re.fullmatch(r"\d{4}", arg):
        return [arg]

    raise argparse.ArgumentTypeError(
        f"Invalid year/range '{arg}'. Expected '2024' or '2020-2025'."
    )


def _safe_int_from_clock(clock: Optional[str]) -> Optional[int]:
    if not clock:
        return None
    m = re.fullmatch(r"(\d{1,2}):(\d{2})", clock.strip())
    if not m:
        return None
    return int(m.group(1)) * 60 + int(m.group(2))


def _normalize_quarter(raw: Optional[int]) -> Optional[int]:
    if raw is None:
        return None
    return int(raw)


def _schedule_payload(game: Dict) -> Dict:
    return {
        "game_id": game["game_id"],
        "competition_id": game["competition_id"],
        "year": game["year"],
        "season_type": game["season_type"],
        "week": game["week"],
        "week_text": game["week_text"],
        "start_time": game["start_time"],

        "home_team_id": game["home_team_id"],
        "away_team_id": game["away_team_id"],
        "home": game["home"],
        "away": game["away"],

        "competition_type": game["competition_type"],
        "competition_type_slug": game["competition_type_slug"],
        "neutral_site": game["neutral_site"],

        "venue_id": game["venue_id"],
        "venue_full_name": game["venue_full_name"],
        "venue_city": game["venue_city"],
        "venue_state": game["venue_state"],
        "venue_country": game["venue_country"],
    }


def _final_payload(game: Dict) -> Dict:
    return {
        "game_id": game["game_id"],
        "competition_id": game["competition_id"],
        "year": game["year"],
        "season_type": game["season_type"],
        "week": game["week"],
        "week_text": game["week_text"],
        "start_time": game["start_time"],
        "home_team_id": game["home_team_id"],
        "away_team_id": game["away_team_id"],
        "home": game["home"],
        "away": game["away"],
        "home_score": game["home_score"],
        "away_score": game["away_score"],
        "status": game["status"],
        "completed": game["completed"],
        "winner": game["winner"],
    }


def _schedule_hash(game: Dict) -> str:
    return _sha256_obj(_schedule_payload(game))


def _final_hash(game: Dict) -> str:
    return _sha256_obj(_final_payload(game))


_GAME_COLUMNS = (
    "game_id", "competition_id", "year", "season_type", "week", "week_text",
    "start_time", "start_timestamp", "expected_end_timestamp",
    "home_team_id", "away_team_id", "home", "away",
    "competition_type", "competition_type_slug", "neutral_site",
    "venue_id", "venue_full_name", "venue_city", "venue_state", "venue_country",
    "home_score", "away_score", "status", "completed", "winner",
    "quarter", "clock",
    "schedule_hash", "final_hash", "schedule_dirty", "final_dirty",
    "schedule_sent_at", "final_sent_at", "last_polled_at", "next_poll_at",
)
_GAME_COLUMNS_SQL = ", ".join(_GAME_COLUMNS)
_GAME_PLACEHOLDERS = ", ".join("?" for _ in _GAME_COLUMNS)
_BOOL_COLUMNS = frozenset(("completed", "neutral_site", "schedule_dirty", "final_dirty"))


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS schedule_refresh (
            year TEXT PRIMARY KEY,
            refreshed_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS games (
            game_id TEXT PRIMARY KEY,
            competition_id TEXT,
            year TEXT,
            season_type TEXT,
            week TEXT,
            week_text TEXT DEFAULT '',
            start_time TEXT,
            start_timestamp REAL,
            expected_end_timestamp REAL,
            home_team_id TEXT,
            away_team_id TEXT,
            home TEXT,
            away TEXT,
            competition_type TEXT DEFAULT '',
            competition_type_slug TEXT DEFAULT '',
            neutral_site INTEGER DEFAULT 0,
            venue_id TEXT,
            venue_full_name TEXT,
            venue_city TEXT,
            venue_state TEXT,
            venue_country TEXT,
            home_score INTEGER DEFAULT 0,
            away_score INTEGER DEFAULT 0,
            status TEXT DEFAULT 'STATUS_NOT_STARTED',
            completed INTEGER DEFAULT 0,
            winner TEXT,
            quarter INTEGER,
            clock TEXT,
            schedule_hash TEXT DEFAULT '',
            final_hash TEXT DEFAULT '',
            schedule_dirty INTEGER DEFAULT 0,
            final_dirty INTEGER DEFAULT 0,
            schedule_sent_at TEXT,
            final_sent_at TEXT,
            last_polled_at REAL,
            next_poll_at REAL
        );
    """)


def open_db(path: str = "") -> sqlite3.Connection:
    conn = sqlite3.connect(path or DB_FILE)
    conn.execute("PRAGMA journal_mode=WAL")
    _ensure_schema(conn)
    return conn


def _row_to_game(row: sqlite3.Row) -> Dict:
    game: Dict = dict(row)
    for col in _BOOL_COLUMNS:
        game[col] = bool(game[col])
    if game["next_poll_at"] is None:
        game["next_poll_at"] = float("inf")
    return game


def _game_to_values(game: Dict) -> tuple:
    values = []
    for col in _GAME_COLUMNS:
        val = game.get(col)
        if col in _BOOL_COLUMNS:
            val = int(bool(val))
        elif col == "next_poll_at" and isinstance(val, float) and val == float("inf"):
            val = None
        values.append(val)
    return tuple(values)


def load_state(conn: sqlite3.Connection) -> Dict:
    state: Dict = {"meta": {"schedule_refresh": {}}, "games": {}}

    for year, ts in conn.execute("SELECT year, refreshed_at FROM schedule_refresh"):
        state["meta"]["schedule_refresh"][year] = ts

    old_factory = conn.row_factory
    conn.row_factory = sqlite3.Row
    for row in conn.execute(f"SELECT {_GAME_COLUMNS_SQL} FROM games"):
        game = _row_to_game(row)
        state["games"][game["game_id"]] = game
    conn.row_factory = old_factory

    log.info(f"Loaded state from SQLite: {len(state['games'])} games tracked")
    return state


def save_state(state: Dict, conn: sqlite3.Connection) -> None:
    try:
        with conn:
            conn.executemany(
                "INSERT OR REPLACE INTO schedule_refresh (year, refreshed_at) VALUES (?, ?)",
                list(state["meta"]["schedule_refresh"].items()),
            )
            conn.executemany(
                f"INSERT OR REPLACE INTO games ({_GAME_COLUMNS_SQL}) VALUES ({_GAME_PLACEHOLDERS})",
                [_game_to_values(g) for g in state["games"].values()],
            )
    except sqlite3.Error as e:
        log.error(f"Failed to save state: {e}")


def _with_jitter(seconds_from_now: float) -> float:
    jitter = random.uniform(0, max(0, POLL_JITTER_SECS))
    return time.time() + max(0.0, seconds_from_now) + jitter


def _build_game_record_from_schedule(details: Dict) -> Dict:
    start_timestamp = _parse_iso(details["start_time"])
    record = {
        "game_id": details["game_id"],
        "competition_id": details["competition_id"],
        "year": details["year"],
        "season_type": details["season_type"],
        "week": details["week"],
        "week_text": details.get("week_text", ""),
        "start_time": details["start_time"],
        "start_timestamp": start_timestamp,
        "expected_end_timestamp": start_timestamp + EXPECTED_GAME_DURATION_SECS,

        "home_team_id": details["home_team_id"],
        "away_team_id": details["away_team_id"],
        "home": details["home"],
        "away": details["away"],

        "competition_type": details["competition_type"],
        "competition_type_slug": details["competition_type_slug"],
        "neutral_site": details["neutral_site"],

        "venue_id": details["venue_id"],
        "venue_full_name": details["venue_full_name"],
        "venue_city": details["venue_city"],
        "venue_state": details["venue_state"],
        "venue_country": details["venue_country"],

        "home_score": 0,
        "away_score": 0,
        "status": "STATUS_NOT_STARTED",
        "completed": False,
        "winner": None,

        "quarter": None,
        "clock": None,

        "schedule_hash": "",
        "final_hash": "",
        "schedule_dirty": True,
        "final_dirty": False,
        "schedule_sent_at": None,
        "final_sent_at": None,
        "last_polled_at": None,
        "next_poll_at": 0.0,
    }
    record["schedule_hash"] = _schedule_hash(record)
    record["final_hash"] = _final_hash(record)
    record["next_poll_at"] = _compute_next_poll_for_game(record, time.time())
    return record


def _schedule_fields_changed(existing: Dict, incoming: Dict) -> bool:
    return any(
        existing.get(k) != incoming.get(k)
        for k in (
            "competition_id",
            "year",
            "season_type",
            "week",
            "week_text",
            "start_time",
            "home_team_id",
            "away_team_id",
            "home",
            "away",
            "competition_type",
            "competition_type_slug",
            "neutral_site",
            "venue_id",
            "venue_full_name",
            "venue_city",
            "venue_state",
            "venue_country",
        )
    )


def _merge_schedule(existing: Dict, incoming: Dict) -> bool:
    changed = False

    if _schedule_fields_changed(existing, incoming):
        for k in (
            "competition_id",
            "year",
            "season_type",
            "week",
            "week_text",
            "start_time",
            "home_team_id",
            "away_team_id",
            "home",
            "away",
            "competition_type",
            "competition_type_slug",
            "neutral_site",
            "venue_id",
            "venue_full_name",
            "venue_city",
            "venue_state",
            "venue_country",
        ):
            existing[k] = incoming[k]

        existing["start_timestamp"] = _parse_iso(existing["start_time"])
        existing["expected_end_timestamp"] = existing["start_timestamp"] + EXPECTED_GAME_DURATION_SECS

        new_schedule_hash = _schedule_hash(existing)
        if new_schedule_hash != existing.get("schedule_hash"):
            existing["schedule_hash"] = new_schedule_hash
            existing["schedule_dirty"] = True
        changed = True

    existing["next_poll_at"] = _compute_next_poll_for_game(existing, time.time())
    return changed


def refresh_schedule(state: Dict, client: EspnClient, year: Optional[str] = None) -> bool:
    if year is None:
        try:
            year = client.get_current()["year"]
        except (APIError, ParsingError) as e:
            log.error(f"Could not fetch current season info: {e}")
            return False

    log.info(f"Refreshing NFL schedule for {year}…")
    changed = False
    games = state["games"]

    for season_type in SEASON_TYPES:
        try:
            week_count = client.get_week_count(year, season_type)
        except (APIError, ParsingError) as e:
            log.warning(f"Could not get week count ({year}/season_type={season_type}): {e}")
            continue

        for week in range(1, week_count + 1):
            week_str = str(week)

            week_text = ""
            try:
                week_text = client.get_week_text(year, season_type, week_str)
            except (APIError, ParsingError) as e:
                log.warning(f"Could not get week text for {year}/{season_type}/W{week_str}: {e}")

            try:
                game_ids = client.get_game_ids(year, season_type, week_str)
            except (APIError, ParsingError) as e:
                log.warning(f"Could not get game IDs for {year}/{season_type}/W{week_str}: {e}")
                continue

            for game_id in game_ids:
                try:
                    details = client.get_game_schedule_details(game_id, year, season_type, week_str)
                except (APIError, ParsingError) as e:
                    log.warning(f"Could not get schedule details for game {game_id}: {e}")
                    continue

                details["week_text"] = week_text
                incoming = _build_game_record_from_schedule(details)
                existing = games.get(game_id)

                if not existing:
                    games[game_id] = incoming
                    changed = True
                    log.info(
                        f"[{year}/S{season_type}/W{week_str}] New game: "
                        f"{details['away']} @ {details['home']} on {details['start_time']}"
                    )
                    continue

                old_schedule_hash = existing.get("schedule_hash")
                _merge_schedule(existing, incoming)

                if existing.get("schedule_hash") != old_schedule_hash:
                    changed = True
                    log.info(
                        f"[{year}/S{season_type}/W{week_str}] Schedule update for game {game_id}: "
                        f"{existing['away']} @ {existing['home']} start_time={existing['start_time']}"
                    )

    state["meta"]["schedule_refresh"][year] = time.time()
    total = sum(1 for g in games.values() if g.get("year") == year)
    completed = sum(1 for g in games.values() if g.get("year") == year and g.get("completed"))
    log.info(f"Schedule refresh complete for {year} — {total} games total, {completed} completed")
    return changed


def _compute_next_poll_for_game(game: Dict, now_ts: float) -> float:
    if game.get("completed"):
        return float("inf")

    start_ts = game.get("start_timestamp", 0.0)
    expected_end_ts = game.get("expected_end_timestamp", start_ts + EXPECTED_GAME_DURATION_SECS)
    status = str(game.get("status", "")).strip().lower()
    quarter = _normalize_quarter(game.get("quarter"))
    clock_secs = _safe_int_from_clock(game.get("clock"))

    if start_ts > now_ts:
        secs_until = start_ts - now_ts

        if secs_until > PRE_KICKOFF_WATCH_SECS:
            return start_ts - PRE_KICKOFF_WATCH_SECS

        if secs_until > PRE_KICKOFF_NEAR_SECS:
            return _with_jitter(PRE_KICKOFF_POLL_SECS)

        return _with_jitter(PRE_KICKOFF_NEAR_POLL_SECS)

    if now_ts >= expected_end_ts:
        return _with_jitter(PAST_EXPECTED_END_POLL_SECS)

    if now_ts >= expected_end_ts - EXPECTED_END_TIGHTEN_SECS:
        return _with_jitter(min(LATE_GAME_POLL_SECS, 60))

    if "scheduled" in status or "not_started" in status or "pre" in status:
        return _with_jitter(PRE_KICKOFF_NEAR_POLL_SECS)

    if "halftime" in status:
        return _with_jitter(HALFTIME_POLL_SECS)

    if "final" in status:
        return now_ts

    if quarter is not None and quarter >= 5:
        if clock_secs is not None and clock_secs <= 300:
            return _with_jitter(OT_FINAL_WINDOW_POLL_SECS)
        return _with_jitter(OT_POLL_SECS)

    if quarter in (1, 2, 3):
        return _with_jitter(IN_PROGRESS_POLL_SECS)

    if quarter == 4:
        if clock_secs is not None and clock_secs <= 300:
            return _with_jitter(FINAL_WINDOW_POLL_SECS)
        return _with_jitter(LATE_GAME_POLL_SECS)

    return _with_jitter(IN_PROGRESS_POLL_SECS)


def _apply_polled_status_details(game: Dict, details: Dict) -> bool:
    changed = False
    old_final_hash = game.get("final_hash")
    was_completed = game.get("completed", False)

    for k in ("home_score", "away_score", "status", "completed", "winner", "quarter", "clock"):
        if game.get(k) != details.get(k):
            game[k] = details.get(k)
            changed = True

    game["last_polled_at"] = time.time()
    game["next_poll_at"] = _compute_next_poll_for_game(game, game["last_polled_at"])

    if game.get("completed"):
        new_final_hash = _final_hash(game)
        if new_final_hash != old_final_hash or not was_completed or not game.get("final_sent_at"):
            game["final_hash"] = new_final_hash
            game["final_dirty"] = True
            changed = True

    return changed


def _poll_priority(game: Dict, now_ts: float) -> Tuple[int, float]:
    if game.get("completed") and game.get("final_dirty"):
        return (0, game.get("next_poll_at", now_ts))

    quarter = _normalize_quarter(game.get("quarter"))
    clock_secs = _safe_int_from_clock(game.get("clock"))

    if quarter is not None and quarter >= 4 and clock_secs is not None and clock_secs <= 300:
        return (1, game.get("next_poll_at", now_ts))

    if not game.get("completed") and game.get("start_timestamp", 0) <= now_ts:
        return (2, game.get("next_poll_at", now_ts))

    return (3, game.get("next_poll_at", now_ts))


def _get_due_game_ids(state: Dict, now_ts: float) -> List[str]:
    due = []
    for game_id, game in state["games"].items():
        if game.get("completed"):
            continue
        if game.get("next_poll_at", float("inf")) <= now_ts:
            due.append(game_id)

    due.sort(key=lambda gid: _poll_priority(state["games"][gid], now_ts))
    return due


def _fetch_game_status_details_task(
    client: EspnClient,
    game: Dict,
) -> Tuple[str, Optional[Dict], Optional[str]]:
    game_id = game["game_id"]
    try:
        details = client.get_game_status_details(
            game_id=game["game_id"],
            competition_id=game["competition_id"],
            home_team_id=game["home_team_id"],
            away_team_id=game["away_team_id"],
        )
        return game_id, details, None
    except (APIError, ParsingError) as e:
        return game_id, None, str(e)


def poll_due_games_concurrently(
    state: Dict,
    client: EspnClient,
    executor: ThreadPoolExecutor,
) -> bool:
    now_ts = time.time()
    due_ids = _get_due_game_ids(state, now_ts)[:MAX_POLLS_PER_CYCLE]
    if not due_ids:
        return False

    changed_any = False
    futures: Dict[Future, str] = {
        executor.submit(_fetch_game_status_details_task, client, state["games"][game_id]): game_id
        for game_id in due_ids
    }

    for future in as_completed(futures):
        game_id = futures[future]
        game = state["games"].get(game_id)
        if not game:
            continue

        try:
            _, details, err = future.result()
        except Exception as e:
            log.warning(f"Unexpected poll failure for game {game_id}: {e}")
            game["next_poll_at"] = _with_jitter(IN_PROGRESS_POLL_SECS)
            continue

        if err:
            log.warning(f"Poll error for game {game_id}: {err}")
            game["next_poll_at"] = _with_jitter(IN_PROGRESS_POLL_SECS)
            continue

        changed = _apply_polled_status_details(game, details)
        if changed:
            changed_any = True
            log.info(
                f"[{game.get('year')}/S{game['season_type']}/W{game['week']}] "
                f"{game['away']} {game['away_score']} @ {game['home']} {game['home_score']} | "
                f"status={game['status']} quarter={game.get('quarter')} clock={game.get('clock')}"
            )

        if game.get("completed"):
            log.info(
                f"GAME COMPLETE — {game['away']} {game['away_score']} @ "
                f"{game['home']} {game['home_score']} | winner={game.get('winner')} | game_id={game_id}"
            )

    return changed_any


def _sign_request(body_str: str) -> Tuple[str, str]:
    """Compute HMAC-SHA256 over ``timestamp.body`` and return (timestamp, signature)."""
    timestamp = str(int(time.time()))
    message = f"{timestamp}.{body_str}"
    signature = _hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return timestamp, signature


def _post_event(event_type: str, games: List[Dict]) -> bool:
    if not games:
        return True

    if not NOTIFY_URL:
        log.info(f"NOTIFY_URL not set; would have sent {event_type} for {len(games)} game(s)")
        return True

    body_dict = {
        "type": event_type,
        "sent_at": utc_now_iso(),
        "games": games,
    }
    body_str = json.dumps(body_dict)

    headers: Dict[str, str] = {"Content-Type": "application/json"}
    if WEBHOOK_SECRET:
        timestamp, signature = _sign_request(body_str)
        headers["X-SS-Timestamp"] = timestamp
        headers["X-SS-Signature"] = signature

    try:
        resp = _requests.post(NOTIFY_URL, data=body_str, headers=headers, timeout=HTTP_TIMEOUT_SECS)
        if resp.status_code not in (200, 201, 202, 204):
            log.warning(f"{event_type} notify returned HTTP {resp.status_code}")
            return False
        return True
    except _requests.RequestException as e:
        log.warning(f"Failed to POST {event_type}: {e}")
        return False


def flush_outbox(state: Dict) -> bool:
    changed = False
    games = list(state["games"].values())

    schedule_batch = [_schedule_payload(g) for g in games if g.get("schedule_dirty")]
    if schedule_batch:
        ok = _post_event("schedule_upsert", schedule_batch)
        if ok:
            sent_at = utc_now_iso()
            for g in games:
                if g.get("schedule_dirty"):
                    g["schedule_dirty"] = False
                    g["schedule_sent_at"] = sent_at
                    changed = True
            log.info(f"Sent schedule_upsert for {len(schedule_batch)} game(s)")

    final_batch = [_final_payload(g) for g in games if g.get("final_dirty") and g.get("completed")]
    if final_batch:
        ok = _post_event("game_final", final_batch)
        if ok:
            sent_at = utc_now_iso()
            for g in games:
                if g.get("final_dirty") and g.get("completed"):
                    g["final_dirty"] = False
                    g["final_sent_at"] = sent_at
                    changed = True
            log.info(f"Sent game_final for {len(final_batch)} game(s)")

    return changed


def compute_service_sleep(state: Dict) -> float:
    now_ts = time.time()
    next_times: List[float] = []

    for game in state["games"].values():
        t = game.get("next_poll_at")
        if isinstance(t, (int, float)) and t != float("inf"):
            next_times.append(t)

    refresh_times = state["meta"].get("schedule_refresh", {})
    if refresh_times:
        latest_refresh = max(refresh_times.values())
        next_times.append(latest_refresh + SCHEDULE_REFRESH_SECS)
    else:
        next_times.append(now_ts)

    if not next_times:
        return 60.0

    next_due = min(next_times)
    return max(5.0, min(next_due - now_ts, MAX_IDLE_SLEEP_SECS))


def _handle_signal(sig, _frame) -> None:
    global _shutdown
    log.info(f"Received signal {sig}, shutting down…")
    _shutdown = True

def hydrate_game_statuses_for_ids(
    state: Dict,
    client: EspnClient,
    executor: ThreadPoolExecutor,
    game_ids: List[str],
) -> bool:
    changed_any = False

    eligible_ids: List[str] = []
    for game_id in game_ids:
        game = state["games"].get(game_id)
        if not game:
            continue

        if not game.get("competition_id") or not game.get("home_team_id") or not game.get("away_team_id"):
            log.warning(f"Skipping status hydrate for game {game_id}: missing derived ids")
            continue

        eligible_ids.append(game_id)

    if not eligible_ids:
        return False

    futures: Dict[Future, str] = {
        executor.submit(_fetch_game_status_details_task, client, state["games"][game_id]): game_id
        for game_id in eligible_ids
    }

    for future in as_completed(futures):
        game_id = futures[future]
        game = state["games"].get(game_id)
        if not game:
            continue

        try:
            _, details, err = future.result()
        except Exception as e:
            log.warning(f"Unexpected hydrate failure for game {game_id}: {e}")
            continue

        if err:
            log.warning(f"Hydrate error for game {game_id}: {err}")
            continue

        changed = _apply_polled_status_details(game, details)
        if changed:
            changed_any = True

    return changed_any

def run_backfill(years: List[str], client: EspnClient) -> None:
    log.info(f"NFL Monitor — backfill mode for year(s): {', '.join(years)}")
    conn = open_db()
    state = load_state(conn)

    with ThreadPoolExecutor(max_workers=POLL_WORKERS, thread_name_prefix="espn-backfill") as executor:
        for year in years:
            log.info(f"--- Backfilling {year} ---")

            refresh_schedule(state, client, year=year)

            year_game_ids = [
                game_id
                for game_id, game in state["games"].items()
                if game.get("year") == year
            ]

            log.info(f"Hydrating statuses for {len(year_game_ids)} game(s) in {year}...")
            hydrate_game_statuses_for_ids(state, client, executor, year_game_ids)

            flush_outbox(state)
            save_state(state, conn)

    save_state(state, conn)
    conn.close()
    log.info("Backfill complete.")


def run() -> None:
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    client = EspnClient()
    conn = open_db()
    state = load_state(conn)
    log.info("NFL Monitor Service starting")

    with ThreadPoolExecutor(max_workers=POLL_WORKERS, thread_name_prefix="espn-poll") as executor:
        while not _shutdown:
            now_ts = time.time()

            live_year: Optional[str] = None
            try:
                live_year = client.get_current()["year"]
            except (APIError, ParsingError) as e:
                log.warning(f"Could not determine current year: {e}")
                refresh_times = state["meta"].get("schedule_refresh", {})
                if refresh_times:
                    live_year = max(refresh_times, key=lambda y: refresh_times[y])

            if live_year:
                last_refresh = state["meta"]["schedule_refresh"].get(live_year, 0)
                if now_ts - last_refresh >= SCHEDULE_REFRESH_SECS:
                    refresh_schedule(state, client, year=live_year)

            poll_due_games_concurrently(state, client, executor)
            flush_outbox(state)
            save_state(state, conn)

            sleep_secs = compute_service_sleep(state)
            log.debug(f"Sleeping {sleep_secs:.0f}s until next check")

            elapsed = 0.0
            while elapsed < sleep_secs and not _shutdown:
                chunk = min(5.0, sleep_secs - elapsed)
                time.sleep(chunk)
                elapsed += chunk

    save_state(state, conn)
    conn.close()
    log.info("NFL Monitor Service stopped")

def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "NFL Score Monitor.\n\n"
            "Run with no arguments to start the continuous live-polling service.\n\n"
            "Pass a year or year-range to do a one-and-done historical backfill."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "years",
        nargs="?",
        metavar="YEARS",
        help="Year or inclusive range to backfill, e.g. '2024' or '2020-2025'.",
    )
    args = parser.parse_args()

    client = EspnClient()

    if args.years:
        try:
            year_list = _parse_years_arg(args.years)
        except argparse.ArgumentTypeError as e:
            parser.error(str(e))
            return
        run_backfill(year_list, client)
    else:
        run()


if __name__ == "__main__":
    main()