"""Weekly meetings report generator."""

from __future__ import annotations

import asyncio
import csv
import datetime
import io
import os
from collections import defaultdict
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db import SessionFactory
from app.models.meeting import Meeting


def parse_iso_week(week: str) -> tuple[datetime.date, datetime.date]:
    """Parse ISO week (e.g. "2026-W40") into (start_date, end_date), Monday to Sunday."""
    parts = week.strip().split("-W")
    if len(parts) != 2:
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
        tz = datetime.timezone.utc

    start_date, end_date = parse_iso_week(week)
    start_dt = datetime.datetime.combine(start_date, datetime.time.min, tzinfo=tz)
    end_dt = datetime.datetime.combine(end_date, datetime.time.min, tzinfo=tz)

    prev_start_date = start_date - datetime.timedelta(days=7)
    prev_end_date = start_date
    prev_start_dt = datetime.datetime.combine(prev_start_date, datetime.time.min, tzinfo=tz)
    prev_end_dt = datetime.datetime.combine(prev_end_date, datetime.time.min, tzinfo=tz)

    async with SessionFactory() as session:
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

    # Totals
    cur_count = len(current_meetings)
    cur_duration_hours = sum(
        (m.ends_at - m.starts_at).total_seconds() for m in current_meetings
    ) / 3600.0

    prev_count = len(prev_meetings)
    prev_duration_hours = sum(
        (m.ends_at - m.starts_at).total_seconds() for m in prev_meetings
    ) / 3600.0

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

    # Summary table
    writer.writerow(["# SUMMARY METRICS"])
    writer.writerow(["Metric", "Current Week", "Previous Week", "Change"])
    writer.writerow(
        ["Total Meetings", cur_count, prev_count, f"{delta_count:+d}"]
    )
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
    writer.writerow(
        ["Rank", "Title", "Start Time", "Duration (hours)", "Participants Count"]
    )
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
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(generate_weekly_report(week))
    else:
        import concurrent.futures

        with concurrent.futures.ThreadPoolExecutor() as executor:
            return executor.submit(asyncio.run, generate_weekly_report(week)).result()
