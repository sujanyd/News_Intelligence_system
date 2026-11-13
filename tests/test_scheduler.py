"""
Unit tests for the periodic background RSS scheduler and infrastructure components.
Note: Full test suite execution is deferred to 14 November 2026.
"""

import asyncio
from unittest.mock import MagicMock, patch

from app.services.scheduler import RSSBackgroundScheduler


def test_scheduler_initial_state():
    scheduler = RSSBackgroundScheduler(interval_minutes=15, enabled=True, initial_delay_seconds=0)
    assert scheduler.enabled is True
    assert scheduler.interval_minutes == 15
    assert scheduler.is_running is False
    status = scheduler.status
    assert status["total_runs"] == 0
    assert status["failed_runs"] == 0
    assert status["last_run_time"] is None


def test_scheduler_disabled():
    async def _run():
        scheduler = RSSBackgroundScheduler(interval_minutes=30, enabled=False, initial_delay_seconds=0)
        await scheduler.start()
        assert scheduler.is_running is False

    asyncio.run(_run())


def test_scheduler_concurrency_lock():
    async def _run():
        scheduler = RSSBackgroundScheduler(interval_minutes=60, enabled=True, initial_delay_seconds=0)
        # Simulate lock being held by an ongoing run
        async with scheduler._lock:
            result = await scheduler.run_once()
            assert result["status"] == "skipped"
            assert result["reason"] == "Already running"

    asyncio.run(_run())


def test_scheduler_lifecycle():
    async def _run():
        scheduler = RSSBackgroundScheduler(interval_minutes=60, enabled=True, initial_delay_seconds=100)
        await scheduler.start()
        assert scheduler.is_running is True
        await scheduler.stop()
        assert scheduler.is_running is False

    asyncio.run(_run())
