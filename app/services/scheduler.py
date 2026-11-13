"""
Periodic RSS Background Scheduler.

Responsible for:
1. Running background ingestion periodically based on environment configuration.
2. Safe duplicate ingestion prevention using an execution lock.
3. Controlled retries and error logging for successful and failed feed runs.
4. Safe lifecycle management (startup and graceful shutdown).
"""

import asyncio
from datetime import datetime, timezone
import logging
from typing import Any, Dict, Optional

from app.core.config import settings
from app.db.session import SessionLocal
from app.services.rss_ingestion import run_rss_ingestion

logger = logging.getLogger(__name__)


class RSSBackgroundScheduler:
    """
    Manages the background execution loop for RSS feed polling.
    Ensures safe single-worker execution with locks, robust retry handling,
    and graceful cancellation upon application shutdown.
    """

    def __init__(
        self,
        interval_minutes: Optional[int] = None,
        enabled: Optional[bool] = None,
        initial_delay_seconds: Optional[int] = None,
    ):
        self.interval_minutes = (
            interval_minutes
            if interval_minutes is not None
            else settings.RSS_SCHEDULER_INTERVAL_MINUTES
        )
        self.enabled = (
            enabled if enabled is not None else settings.RSS_SCHEDULER_ENABLED
        )
        self.initial_delay_seconds = (
            initial_delay_seconds
            if initial_delay_seconds is not None
            else settings.RSS_SCHEDULER_INITIAL_DELAY_SECONDS
        )

        self._task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()
        self._is_running = False
        self._last_run_time: Optional[datetime] = None
        self._last_run_summary: Optional[Dict[str, Any]] = None
        self._total_runs = 0
        self._failed_runs = 0

    @property
    def is_running(self) -> bool:
        return self._is_running and self._task is not None and not self._task.done()

    @property
    def status(self) -> Dict[str, Any]:
        return {
            "enabled": self.enabled,
            "is_running": self.is_running,
            "interval_minutes": self.interval_minutes,
            "total_runs": self._total_runs,
            "failed_runs": self._failed_runs,
            "last_run_time": (
                self._last_run_time.isoformat() if self._last_run_time else None
            ),
            "last_run_summary": self._last_run_summary,
        }

    async def start(self) -> None:
        """
        Starts the background ingestion task loop if enabled.
        """
        if not self.enabled:
            logger.info("RSS background scheduler is disabled via configuration.")
            return

        if self.is_running:
            logger.warning("RSS background scheduler is already running.")
            return

        self._is_running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info(
            "RSS background scheduler started (interval: %d minutes, initial delay: %d seconds).",
            self.interval_minutes,
            self.initial_delay_seconds,
        )

    async def stop(self) -> None:
        """
        Signals the background task to cancel and waits for clean exit.
        """
        self._is_running = False
        if self._task and not self._task.done():
            logger.info("Stopping RSS background scheduler task...")
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            logger.info("RSS background scheduler task terminated gracefully.")
        self._task = None

    async def run_once(self) -> Dict[str, Any]:
        """
        Executes a single cycle of RSS ingestion guarded by an async lock
        to strictly prevent concurrent duplicate ingestion runs.
        """
        if self._lock.locked():
            logger.warning("Ingestion cycle already in progress; skipping duplicate run.")
            return {"status": "skipped", "reason": "Already running"}

        async with self._lock:
            start_time = datetime.now(timezone.utc)
            logger.info("Starting scheduled RSS ingestion cycle at %s...", start_time.isoformat())
            self._total_runs += 1

            # Run synchronous blocking DB / network operations in threadpool
            try:
                summary = await asyncio.to_thread(self._execute_sync_ingestion)
                self._last_run_time = datetime.now(timezone.utc)
                self._last_run_summary = {
                    "status": "success",
                    "feeds_attempted": summary.feeds_attempted,
                    "feeds_successful": summary.feeds_successful,
                    "articles_inserted": summary.articles_inserted,
                    "articles_skipped_duplicate": summary.articles_skipped_duplicate,
                    "feed_errors": summary.feed_errors,
                    "feed_retries": summary.feed_retries,
                    "elapsed_seconds": (self._last_run_time - start_time).total_seconds(),
                }
                logger.info(
                    "Scheduled RSS ingestion finished: %d feeds successful, %d articles inserted, "
                    "%d duplicates skipped, %d errors.",
                    summary.feeds_successful,
                    summary.articles_inserted,
                    summary.articles_skipped_duplicate,
                    summary.feed_errors,
                )
                return self._last_run_summary
            except Exception as exc:
                self._failed_runs += 1
                self._last_run_time = datetime.now(timezone.utc)
                self._last_run_summary = {
                    "status": "failed",
                    "error": str(exc),
                    "elapsed_seconds": (self._last_run_time - start_time).total_seconds(),
                }
                logger.error("Scheduled RSS ingestion failed with exception: %s", exc, exc_info=True)
                return self._last_run_summary

    def _execute_sync_ingestion(self):
        """
        Worker method running inside asyncio.to_thread with its own DB session.
        """
        db = SessionLocal()
        try:
            return run_rss_ingestion(db=db)
        finally:
            db.close()

    async def _run_loop(self) -> None:
        """
        Continuous interval loop for the scheduler.
        """
        # Initial boot delay to allow application startup and warmups to complete
        if self.initial_delay_seconds > 0:
            try:
                await asyncio.sleep(self.initial_delay_seconds)
            except asyncio.CancelledError:
                return

        while self._is_running:
            try:
                await self.run_once()
            except Exception as loop_exc:
                logger.error("Unexpected error in RSS scheduler loop: %s", loop_exc)

            # Sleep for the configured interval
            interval_seconds = max(60, self.interval_minutes * 60)
            try:
                await asyncio.sleep(interval_seconds)
            except asyncio.CancelledError:
                break


# Global scheduler instance
_rss_scheduler: Optional[RSSBackgroundScheduler] = None


def get_rss_scheduler() -> RSSBackgroundScheduler:
    """
    Returns the singleton RSS background scheduler.
    """
    global _rss_scheduler
    if _rss_scheduler is None:
        _rss_scheduler = RSSBackgroundScheduler()
    return _rss_scheduler

