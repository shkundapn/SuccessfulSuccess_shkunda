"""Weekly report endpoints: request on-demand, preview, and download."""

import json
import logging
import os
from typing import Any

import boto3
from fastapi import APIRouter, Query, Response, status
from pydantic import BaseModel

from app.reports.weekly import (
    generate_weekly_report,
    get_recent_weeks,
    get_weekly_report_summary,
    normalize_iso_week,
)

router = APIRouter(prefix="/reports", tags=["reports"])
logger = logging.getLogger("app.reports")


class ReportRequestInput(BaseModel):
    week: str | None = None
    recipient: str | None = None


@router.get(
    "/weeks",
    summary="List available recent ISO weeks with friendly labels",
)
async def list_report_weeks() -> list[dict[str, Any]]:
    """Return past and current ISO weeks for selection."""
    return get_recent_weeks(count=6)


@router.get(
    "/preview",
    summary="Preview weekly meetings metrics and breakdown",
)
async def preview_weekly_report(
    week: str | None = Query(default=None, description="ISO week (e.g. 2026-W41, current, last)"),
) -> dict[str, Any]:
    """Return summary metrics for the designated week."""
    return await get_weekly_report_summary(week)


@router.get(
    "/download",
    summary="Download the CSV report file directly for a designated week",
)
async def download_weekly_report(
    week: str | None = Query(default=None, description="ISO week (e.g. 2026-W41, current, last)"),
) -> Response:
    """Generate and stream the CSV report for direct browser download."""
    resolved_week = normalize_iso_week(week)
    csv_bytes = await generate_weekly_report(resolved_week)
    filename = f"weekly-meetings-report-{resolved_week}.csv"
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": "text/csv; charset=utf-8",
        },
    )


@router.post(
    "/request",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger on-demand generation and email delivery of a weekly report",
)
async def request_weekly_report(payload: ReportRequestInput | None = None) -> dict[str, Any]:
    """Enqueue a report request message to SQS (or invoke the builder)."""
    raw_week = payload.week if payload else None
    resolved_week = normalize_iso_week(raw_week)
    recipient = (payload.recipient or "").strip() if payload else None
    if not recipient:
        recipient = "maksym.shkunda.25@cnu.edu.ua"

    queue_url = os.getenv(
        "REPORT_QUEUE_URL",
        "https://sqs.us-east-1.amazonaws.com/783216615378/spry-shkunda-report-requests",
    )
    region = os.getenv("AWS_REGION", "us-east-1")

    message_body = json.dumps(
        {
            "week": resolved_week,
            "source": "api",
            "recipient": recipient,
        }
    )

    try:
        sqs = boto3.client("sqs", region_name=region)
        resp = sqs.send_message(QueueUrl=queue_url, MessageBody=message_body)
        mid = resp.get("MessageId")
        logger.info(f"Report request enqueued via SQS: week={resolved_week} MessageId={mid}")
        return {
            "status": "queued",
            "message_id": mid,
            "week": resolved_week,
            "recipient": recipient,
        }
    except Exception as exc:
        logger.warning(
            f"SQS send_message failed ({exc}), falling back to direct Lambda invocation..."
        )
        lambda_client = boto3.client("lambda", region_name=region)
        lambda_client.invoke(
            FunctionName="spry-shkunda-report-builder",
            InvocationType="Event",
            Payload=message_body.encode("utf-8"),
        )
        return {
            "status": "invoking",
            "week": resolved_week,
            "recipient": recipient,
        }
