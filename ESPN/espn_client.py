#!/usr/bin/env python3

from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, TypedDict

import requests
from requests import Response, Session


class APIError(Exception):
    pass


class ParsingError(Exception):
    pass


class CurrentInfo(TypedDict):
    week: str
    year: str
    seasonType: str


class GameScheduleDetails(TypedDict):
    game_id: str
    competition_id: str
    year: str
    season_type: str
    week: str
    start_time: str

    home_team_id: str
    away_team_id: str
    home: str
    away: str

    competition_type: str
    competition_type_slug: str
    neutral_site: bool

    venue_id: Optional[str]
    venue_full_name: Optional[str]
    venue_city: Optional[str]
    venue_state: Optional[str]
    venue_country: Optional[str]


class GameStatusDetails(TypedDict):
    home_score: int
    away_score: int
    status: str
    completed: bool
    quarter: Optional[int]
    clock: Optional[str]
    winner: Optional[str]  # "home", "away", or None


@dataclass(frozen=True)
class EspnClientConfig:
    base_url: str = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl"
    timeout_connect_secs: float = 5.0
    timeout_read_secs: float = 10.0
    user_agent: str = "nfl-monitor/1.0"
    ref_fetch_workers: int = 6


class EspnClient:
    def __init__(
        self,
        config: Optional[EspnClientConfig] = None,
        session: Optional[Session] = None,
    ) -> None:
        self.config = config or EspnClientConfig()
        self.session = session or requests.Session()
        self.session.headers.update(
            {
                "Accept": "application/json",
                "User-Agent": self.config.user_agent,
            }
        )
        self._team_abbr_cache: Dict[tuple[str, str], str] = {}

    def get_current(self) -> CurrentInfo:
        url = f"{self.config.base_url}/events"
        data = self._get_json(url, "Failed to get current season metadata")

        try:
            params = data["$meta"]["parameters"]
            return {
                "week": self._as_str(params["week"][0], "current week"),
                "year": self._as_str(params["season"][0], "current year"),
                "seasonType": self._as_str(params["seasontypes"][0], "current seasonType"),
            }
        except (KeyError, IndexError, TypeError) as e:
            raise ParsingError(f"Invalid current metadata shape: {e}") from e

    def get_week_count(self, year: str, season_type: str) -> int:
        url = f"{self.config.base_url}/seasons/{year}/types/{season_type}/weeks"
        data = self._get_json(url, f"Failed to get week count for {year}/{season_type}")
        try:
            count = data["count"]
            if not isinstance(count, int):
                raise TypeError(f"count is not int: {type(count).__name__}")
            return count
        except (KeyError, TypeError) as e:
            raise ParsingError(f"Invalid week count response for {year}/{season_type}: {e}") from e

    def get_week_text(self, year: str, season_type: str, week: str) -> str:
        url = f"{self.config.base_url}/seasons/{year}/types/{season_type}/weeks/{week}"
        data = self._get_json(url, f"Failed to get week detail for {year}/{season_type}/week {week}")
        try:
            return self._require_str(data, "text", f"week text for {year}/{season_type}/week {week}")
        except (KeyError, TypeError) as e:
            raise ParsingError(f"Invalid week detail response for {year}/{season_type}/week {week}: {e}") from e

    def get_game_ids(self, year: str, season_type: str, week: str) -> List[str]:
        url = f"{self.config.base_url}/seasons/{year}/types/{season_type}/weeks/{week}/events"
        data = self._get_json(url, f"Failed to get game IDs for {year}/{season_type}/week {week}")

        try:
            game_ids: List[str] = []
            for item in data.get("items", []):
                ref = item["$ref"]
                if not isinstance(ref, str):
                    raise TypeError(f"$ref is not str: {type(ref).__name__}")
                game_id = ref.split("/events/")[1].split("?")[0]
                game_ids.append(game_id)
            return game_ids
        except (KeyError, IndexError, TypeError) as e:
            raise ParsingError(f"Failed to parse game IDs for {year}/{season_type}/week {week}: {e}") from e

    def get_game_schedule_details(
        self,
        game_id: str,
        year: str,
        season_type: str,
        week: str,
    ) -> GameScheduleDetails:
        """
        Used during refresh/backfill.

        Fetches:
        - event doc for start time / competitors / competition id
        - team abbreviations (cached by year + team id)
        - competition metadata already present on the event payload
        """
        event_url = f"{self.config.base_url}/events/{game_id}"
        event = self._get_json(event_url, f"Failed to get schedule details for game {game_id}")

        try:
            competition = event["competitions"][0]
            competition_id = self._require_str(competition, "id", f"competition id for game {game_id}")
            start_time = self._require_str(event, "date", f"start time for game {game_id}")

            competitors = competition["competitors"]
            home_comp = next(c for c in competitors if c["homeAway"] == "home")
            away_comp = next(c for c in competitors if c["homeAway"] == "away")

            home_team_id = self._require_str(home_comp, "id", f"home team id for game {game_id}")
            away_team_id = self._require_str(away_comp, "id", f"away team id for game {game_id}")

            home_abbr = self._get_team_abbreviation(year, home_team_id)
            away_abbr = self._get_team_abbreviation(year, away_team_id)

            comp_type = competition.get("type", {})
            venue = competition.get("venue", {})
            address = venue.get("address", {}) if isinstance(venue, dict) else {}

            return {
                "game_id": game_id,
                "competition_id": competition_id,
                "year": year,
                "season_type": season_type,
                "week": week,
                "start_time": start_time,

                "home_team_id": home_team_id,
                "away_team_id": away_team_id,
                "home": home_abbr,
                "away": away_abbr,

                "competition_type": self._optional_str(comp_type.get("type")) or "",
                "competition_type_slug": self._optional_str(comp_type.get("slug")) or "",
                "neutral_site": self._optional_bool(competition.get("neutralSite")) is True,

                "venue_id": self._optional_str(venue.get("id")) if isinstance(venue, dict) else None,
                "venue_full_name": self._optional_str(venue.get("fullName")) if isinstance(venue, dict) else None,
                "venue_city": self._optional_str(address.get("city")) if isinstance(address, dict) else None,
                "venue_state": self._optional_str(address.get("state")) if isinstance(address, dict) else None,
                "venue_country": self._optional_str(address.get("country")) if isinstance(address, dict) else None,
            }
        except (KeyError, IndexError, StopIteration, TypeError) as e:
            raise ParsingError(f"Failed to parse schedule details for game {game_id}: {e}") from e

    def get_game_status_details(
        self,
        *,
        game_id: str,
        competition_id: str,
        home_team_id: str,
        away_team_id: str,
    ) -> GameStatusDetails:
        """
        Used during polling.

        Fetches only:
        - competition status
        - home score
        - away score

        All derived directly from known IDs, so we do not need to re-fetch
        the event document just to rediscover refs.
        """
        status_url = (
            f"{self.config.base_url}/events/{game_id}/competitions/{competition_id}/status"
        )
        home_score_url = (
            f"{self.config.base_url}/events/{game_id}/competitions/{competition_id}"
            f"/competitors/{home_team_id}/score"
        )
        away_score_url = (
            f"{self.config.base_url}/events/{game_id}/competitions/{competition_id}"
            f"/competitors/{away_team_id}/score"
        )

        fetched = self._fetch_json_map_concurrently(
            {
                "status": status_url,
                "home_score": home_score_url,
                "away_score": away_score_url,
            }
        )

        status = fetched["status"]
        home_score = fetched["home_score"]
        away_score = fetched["away_score"]

        home_winner = self._optional_bool(home_score.get("winner"))
        away_winner = self._optional_bool(away_score.get("winner"))

        winner: Optional[str]
        if home_winner is True:
            winner = "home"
        elif away_winner is True:
            winner = "away"
        else:
            winner = None

        try:
            return {
                "home_score": self._require_int_like(home_score, "value", f"home score for game {game_id}"),
                "away_score": self._require_int_like(away_score, "value", f"away score for game {game_id}"),
                "status": self._require_str(status["type"], "name", f"status name for game {game_id}"),
                "completed": self._require_bool(status["type"], "completed", f"completed flag for game {game_id}"),
                "quarter": self._optional_int(status.get("period"), f"period for game {game_id}"),
                "clock": self._optional_str(status.get("displayClock")),
                "winner": winner,
            }
        except (KeyError, TypeError) as e:
            raise ParsingError(f"Failed to parse status details for game {game_id}: {e}") from e

    def _get_team_abbreviation(self, year: str, team_id: str) -> str:
        cache_key = (year, team_id)
        cached = self._team_abbr_cache.get(cache_key)
        if cached is not None:
            return cached

        url = f"{self.config.base_url}/seasons/{year}/teams/{team_id}"
        data = self._get_json(url, f"Failed to get team metadata for year={year} team={team_id}")
        abbr = self._require_str(data, "abbreviation", f"team abbreviation for year={year} team={team_id}")
        self._team_abbr_cache[cache_key] = abbr
        return abbr

    def _fetch_json_map_concurrently(self, urls: Dict[str, str]) -> Dict[str, Dict[str, Any]]:
        if not urls:
            return {}

        results: Dict[str, Dict[str, Any]] = {}
        max_workers = min(self.config.ref_fetch_workers, len(urls))

        with ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="espn-ref") as executor:
            futures = {
                executor.submit(self._get_json, url, f"Failed to fetch {name}"): name
                for name, url in urls.items()
            }

            for future in as_completed(futures):
                name = futures[future]
                try:
                    results[name] = future.result()
                except Exception as e:
                    raise APIError(f"Concurrent fetch failed for {name}: {e}") from e

        return results

    def _get_json(self, url: str, context: str) -> Dict[str, Any]:
        response = self._get(url, context)
        try:
            data = response.json()
        except json.JSONDecodeError as e:
            raise ParsingError(f"{context}: invalid JSON: {e}") from e

        if not isinstance(data, dict):
            raise ParsingError(f"{context}: expected JSON object, got {type(data).__name__}")
        return data

    def _get(self, url: str, context: str) -> Response:
        try:
            response = self.session.get(
                url,
                timeout=(self.config.timeout_connect_secs, self.config.timeout_read_secs),
            )
        except requests.RequestException as e:
            raise APIError(f"{context}: network error: {e}") from e

        if response.status_code != 200:
            raise APIError(f"{context}: HTTP {response.status_code}")
        return response

    @staticmethod
    def _require_str(data: Dict[str, Any], key: str, context: str) -> str:
        value = data[key]
        if not isinstance(value, str):
            raise ParsingError(f"Invalid {context}: expected str, got {type(value).__name__}")
        return value

    @staticmethod
    def _require_bool(data: Dict[str, Any], key: str, context: str) -> bool:
        value = data[key]
        if not isinstance(value, bool):
            raise ParsingError(f"Invalid {context}: expected bool, got {type(value).__name__}")
        return value

    @staticmethod
    def _require_int_like(data: Dict[str, Any], key: str, context: str) -> int:
        value = data[key]

        if isinstance(value, int):
            return value
        if isinstance(value, float):
            if value.is_integer():
                return int(value)
            raise ParsingError(f"Invalid {context}: expected whole-number value, got {value!r}")
        if isinstance(value, str):
            try:
                f = float(value)
            except ValueError as e:
                raise ParsingError(f"Invalid {context}: expected numeric string, got {value!r}") from e
            if f.is_integer():
                return int(f)
            raise ParsingError(f"Invalid {context}: expected whole-number value, got {value!r}")

        raise ParsingError(f"Invalid {context}: expected numeric value, got {type(value).__name__}")

    @staticmethod
    def _optional_int(value: Any, context: str) -> Optional[int]:
        if value is None:
            return None
        if isinstance(value, int):
            return value
        if isinstance(value, float) and value.is_integer():
            return int(value)
        if isinstance(value, str) and value.isdigit():
            return int(value)
        raise ParsingError(f"Invalid {context}: expected int-like value or None, got {value!r}")

    @staticmethod
    def _optional_str(value: Any) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, str):
            return value
        return str(value)

    @staticmethod
    def _optional_bool(value: Any) -> Optional[bool]:
        if value is None:
            return None
        if isinstance(value, bool):
            return value
        return None

    @staticmethod
    def _as_str(value: Any, context: str) -> str:
        if isinstance(value, str):
            return value
        return str(value)