"""Weekly meetings report generator."""

from __future__ import annotations

import asyncio
import csv
import datetime
import io
import os
from collections import defaultdict
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import selectinload
from sqlalchemy.pool import NullPool

from app.models.meeting import Meeting


def normalize_iso_week(week: str | None, tz: datetime.tzinfo | None = None) -> str:
    """Normalize week parameter into uppercase ISO week string 'YYYY-Www'.

    Supports:
      - None, '', 'default', 'last', 'prev', 'previous' -> previous ISO week
      - 'current', 'curr', 'this', 'now' -> current ISO week
      - '2026-w41' -> '2026-W41'
      - '2026W41' -> '2026-W41'
    """
    if tz is None:
        tz_name = os.getenv("APP_TIMEZONE", "Europe/Kyiv")
        try:
            tz = ZoneInfo(tz_name)
        except Exception:
            tz = datetime.UTC

    now = datetime.datetime.now(tz)

    if (
        not week
        or not str(week).strip()
        or str(week).strip().lower() in ("default", "last", "prev", "previous")
    ):
        last_week = now - datetime.timedelta(days=7)
        year, week_num, _ = last_week.isocalendar()
        return f"{year}-W{week_num:02d}"

    val = str(week).strip().lower()
    if val in ("current", "curr", "this", "now"):
        year, week_num, _ = now.isocalendar()
        return f"{year}-W{week_num:02d}"

    cleaned = str(week).strip().upper()
    if "-W" not in cleaned and "W" in cleaned:
        cleaned = cleaned.replace("W", "-W")

    parts = cleaned.split("-W")
    if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
        return f"{int(parts[0]):04d}-W{int(parts[1]):02d}"

    return cleaned


def parse_iso_week(week: str) -> tuple[datetime.date, datetime.date]:
    """Parse ISO week (e.g. "2026-W40") into (start_date, end_date), Monday to Sunday."""
    cleaned = normalize_iso_week(week)
    parts = cleaned.split("-W")
    if len(parts) != 2 or not parts[0].isdigit() or not parts[1].isdigit():
        raise ValueError(f"Invalid ISO week format '{week}', expected YYYY-Www (e.g. 2026-W40)")
    year = int(parts[0])
    week_num = int(parts[1])
    start_date = datetime.date.fromisocalendar(year, week_num, 1)
    end_date = start_date + datetime.timedelta(days=7)
    return start_date, end_date


async def generate_weekly_report(week: str) -> bytes:
    """Async implementation: query database and build the CSV report for an ISO week."""
    tz_name = os.getenv("APP_TIMEZONE", "Europe/Kyiv")
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = datetime.UTC

    start_date, end_date = parse_iso_week(week)
    start_dt = datetime.datetime.combine(start_date, datetime.time.min, tzinfo=tz)
    end_dt = datetime.datetime.combine(end_date, datetime.time.min, tzinfo=tz)

    prev_start_date = start_date - datetime.timedelta(days=7)
    prev_end_date = start_date
    prev_start_dt = datetime.datetime.combine(prev_start_date, datetime.time.min, tzinfo=tz)
    prev_end_dt = datetime.datetime.combine(prev_end_date, datetime.time.min, tzinfo=tz)

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL environment variable is required")

    # Using NullPool avoids asyncpg connections sticking to old event loops in Lambda
    engine = create_async_engine(db_url, echo=False, poolclass=NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

    try:
        async with session_factory() as session:
            # Current week meetings
            stmt = (
                select(Meeting)
                .options(selectinload(Meeting.participants))
                .where(Meeting.starts_at >= start_dt, Meeting.starts_at < end_dt)
                .order_by(Meeting.starts_at)
            )
            res = await session.execute(stmt)
            current_meetings = list(res.scalars().all())

            # Previous week meetings
            prev_stmt = (
                select(Meeting)
                .options(selectinload(Meeting.participants))
                .where(Meeting.starts_at >= prev_start_dt, Meeting.starts_at < prev_end_dt)
                .order_by(Meeting.starts_at)
            )
            prev_res = await session.execute(prev_stmt)
            prev_meetings = list(prev_res.scalars().all())
    finally:
        await engine.dispose()

    # Totals
    cur_count = len(current_meetings)
    cur_duration_hours = (
        sum((m.ends_at - m.starts_at).total_seconds() for m in current_meetings) / 3600.0
    )

    prev_count = len(prev_meetings)
    prev_duration_hours = (
        sum((m.ends_at - m.starts_at).total_seconds() for m in prev_meetings) / 3600.0
    )

    delta_count = cur_count - prev_count
    delta_hours = cur_duration_hours - prev_duration_hours

    # Top 5 longest meetings
    longest = sorted(
        current_meetings,
        key=lambda m: (m.ends_at - m.starts_at).total_seconds(),
        reverse=True,
    )[:5]

    # Breakdown per owner/organizer
    by_owner: dict[str, list[Meeting]] = defaultdict(list)
    for m in current_meetings:
        by_owner[m.owner_id or "Unassigned"].append(m)

    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")

    # Header / Meta
    writer.writerow(["# WEEKLY MEETINGS REPORT"])
    writer.writerow(["Week", week])
    writer.writerow(["Timezone", str(tz)])
    writer.writerow(
        [
            "Period",
            f"{start_date.isoformat()} to {(end_date - datetime.timedelta(days=1)).isoformat()}",
        ]
    )
    writer.writerow([])

    prev_y, prev_w, _ = prev_start_date.isocalendar()
    prev_week = f"{prev_y}-W{prev_w:02d}"

    # Summary table
    writer.writerow(["# SUMMARY METRICS"])
    writer.writerow(["Metric", f"Report Week ({week})", f"Prior Week ({prev_week})", "Change"])
    writer.writerow(["Total Meetings", cur_count, prev_count, f"{delta_count:+d}"])
    writer.writerow(
        [
            "Total Duration (hours)",
            f"{cur_duration_hours:.2f}",
            f"{prev_duration_hours:.2f}",
            f"{delta_hours:+.2f}",
        ]
    )
    writer.writerow([])

    # Top 5 longest
    writer.writerow(["# TOP 5 LONGEST MEETINGS"])
    writer.writerow(["Rank", "Title", "Start Time", "Duration (hours)", "Participants Count"])
    if longest:
        for i, m in enumerate(longest, 1):
            dur_h = (m.ends_at - m.starts_at).total_seconds() / 3600.0
            writer.writerow(
                [
                    i,
                    m.name,
                    m.starts_at.isoformat(),
                    f"{dur_h:.2f}",
                    len(m.participants),
                ]
            )
    else:
        writer.writerow(["-", "No meetings in this week", "-", "0.00", 0])
    writer.writerow([])

    # Breakdown per organizer
    writer.writerow(["# BREAKDOWN BY ORGANIZER"])
    writer.writerow(["Organizer / Owner ID", "Meetings Count", "Total Duration (hours)"])
    if by_owner:
        for owner, m_list in sorted(by_owner.items()):
            dur_h = sum((m.ends_at - m.starts_at).total_seconds() for m in m_list) / 3600.0
            writer.writerow([owner, len(m_list), f"{dur_h:.2f}"])
    else:
        writer.writerow(["None", 0, "0.00"])
    writer.writerow([])

    # All meetings list
    writer.writerow(["# ALL MEETINGS"])
    writer.writerow(
        [
            "ID",
            "Title",
            "Starts At",
            "Ends At",
            "Duration (min)",
            "Participants Count",
            "Participants",
        ]
    )
    for m in current_meetings:
        dur_min = int(round((m.ends_at - m.starts_at).total_seconds() / 60.0))
        p_names = "; ".join(p.name for p in m.participants)
        writer.writerow(
            [
                str(m.id),
                m.name,
                m.starts_at.isoformat(),
                m.ends_at.isoformat(),
                dur_min,
                len(m.participants),
                p_names,
            ]
        )

    return output.getvalue().encode("utf-8")


def build_weekly_report(week: str) -> bytes:
    """Query the meetings of one ISO week (e.g. '2026-W40') and return the CSV."""
    return asyncio.run(generate_weekly_report(week))


def get_recent_weeks(count: int = 6) -> list[dict[str, Any]]:
    """Return a list of recent ISO weeks with descriptive human-readable labels."""
    tz_name = os.getenv("APP_TIMEZONE", "Europe/Kyiv")
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = datetime.UTC

    now = datetime.datetime.now(tz)
    cur_year, cur_week_num, _ = now.isocalendar()
    cur_week = f"{cur_year}-W{cur_week_num:02d}"

    last_week_dt = now - datetime.timedelta(days=7)
    last_year, last_week_num, _ = last_week_dt.isocalendar()
    last_week = f"{last_year}-W{last_week_num:02d}"

    weeks = []
    # Start from current week and go backwards
    for i in range(count):
        ref_dt = now - datetime.timedelta(days=7 * i)
        y, w, _ = ref_dt.isocalendar()
        week_str = f"{y}-W{w:02d}"
        s_date, e_date = parse_iso_week(week_str)
        # e_date is next Monday, so Sunday is e_date - 1 day
        sunday = e_date - datetime.timedelta(days=1)
        date_range_str = f"{s_date.strftime('%b %d')} – {sunday.strftime('%b %d')}"

        if week_str == cur_week:
            tag = "Current Week"
        elif week_str == last_week:
            tag = "Last Week"
        else:
            tag = ""

        label = f"{week_str} ({date_range_str})"
        if tag:
            label = f"{label} — {tag}"

        weeks.append(
            {
                "week": week_str,
                "label": label,
                "start_date": s_date.isoformat(),
                "end_date": sunday.isoformat(),
                "is_current": week_str == cur_week,
                "is_last": week_str == last_week,
            }
        )

    return weeks


async def get_weekly_report_summary(week: str | None = None) -> dict[str, Any]:
    """Query database and return structured weekly report statistics for API preview."""
    tz_name = os.getenv("APP_TIMEZONE", "Europe/Kyiv")
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = datetime.UTC

    resolved_week = normalize_iso_week(week, tz)
    start_date, end_date = parse_iso_week(resolved_week)
    start_dt = datetime.datetime.combine(start_date, datetime.time.min, tzinfo=tz)
    end_dt = datetime.datetime.combine(end_date, datetime.time.min, tzinfo=tz)

    prev_start_date = start_date - datetime.timedelta(days=7)
    prev_end_date = start_date
    prev_start_dt = datetime.datetime.combine(prev_start_date, datetime.time.min, tzinfo=tz)
    prev_end_dt = datetime.datetime.combine(prev_end_date, datetime.time.min, tzinfo=tz)

    prev_y, prev_w, _ = prev_start_date.isocalendar()
    prev_week = f"{prev_y}-W{prev_w:02d}"

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL environment variable is required")

    engine = create_async_engine(db_url, echo=False, poolclass=NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

    try:
        async with session_factory() as session:
            stmt = (
                select(Meeting)
                .options(selectinload(Meeting.participants))
                .where(Meeting.starts_at >= start_dt, Meeting.starts_at < end_dt)
                .order_by(Meeting.starts_at)
            )
            res = await session.execute(stmt)
            current_meetings = list(res.scalars().all())

            prev_stmt = (
                select(Meeting)
                .options(selectinload(Meeting.participants))
                .where(Meeting.starts_at >= prev_start_dt, Meeting.starts_at < prev_end_dt)
                .order_by(Meeting.starts_at)
            )
            prev_res = await session.execute(prev_stmt)
            prev_meetings = list(prev_res.scalars().all())
    finally:
        await engine.dispose()

    cur_count = len(current_meetings)
    cur_duration_hours = (
        sum((m.ends_at - m.starts_at).total_seconds() for m in current_meetings) / 3600.0
    )

    prev_count = len(prev_meetings)
    prev_duration_hours = (
        sum((m.ends_at - m.starts_at).total_seconds() for m in prev_meetings) / 3600.0
    )

    unique_participants = {p.name for m in current_meetings for p in m.participants}

    end_date_inclusive = end_date - datetime.timedelta(days=1)
    period_str = f"{start_date.isoformat()} to {end_date_inclusive.isoformat()}"

    return {
        "week": resolved_week,
        "period": period_str,
        "start_date": start_date.isoformat(),
        "end_date": end_date_inclusive.isoformat(),
        "meetings_count": cur_count,
        "duration_hours": round(cur_duration_hours, 2),
        "prev_week": prev_week,
        "prev_meetings_count": prev_count,
        "prev_duration_hours": round(prev_duration_hours, 2),
        "delta_count": cur_count - prev_count,
        "delta_hours": round(cur_duration_hours - prev_duration_hours, 2),
        "unique_participants_count": len(unique_participants),
        "meetings": [
            {
                "id": str(m.id),
                "name": m.name,
                "starts_at": m.starts_at.isoformat(),
                "ends_at": m.ends_at.isoformat(),
                "duration_min": int(round((m.ends_at - m.starts_at).total_seconds() / 60.0)),
                "participants_count": len(m.participants),
                "participants": [p.name for p in m.participants],
            }
            for m in current_meetings
        ],
    }
