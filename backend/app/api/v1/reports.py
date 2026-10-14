"""Weekly report on-demand request endpoint."""

import json
import logging
import os
from typing import Any

import boto3
from fastapi import APIRouter, status
from pydantic import BaseModel

router = APIRouter(prefix="/reports", tags=["reports"])
logger = logging.getLogger("app.reports")


class ReportRequestInput(BaseModel):
    week: str | None = None
    recipient: str | None = None


@router.post(
    "/request",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger on-demand generation and email delivery of a weekly report",
)
async def request_weekly_report(payload: ReportRequestInput | None = None) -> dict[str, Any]:
    """Enqueue a report request message to SQS (or invoke the builder)."""
    week = payload.week if payload else None
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
            "week": week,
            "source": "api",
            "recipient": recipient,
        }
    )

    try:
        sqs = boto3.client("sqs", region_name=region)
        resp = sqs.send_message(QueueUrl=queue_url, MessageBody=message_body)
        logger.info(f"Report request enqueued via SQS: {resp.get('MessageId')}")
        return {
            "status": "queued",
            "message_id": resp.get("MessageId"),
            "week": week,
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
            "week": week,
            "recipient": recipient,
        }
