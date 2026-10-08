"""AWS Lambda handlers for report builder and mailer."""

from __future__ import annotations

import datetime
import json
import logging
import os
import urllib.parse
from email.message import EmailMessage
from typing import Any
from zoneinfo import ZoneInfo

import boto3

from app.reports.weekly import build_weekly_report

# Configure structured logging
logger = logging.getLogger("app.reports")
logger.setLevel(os.getenv("LOG_LEVEL", "INFO").upper())
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)


def detect_trigger(event: dict[str, Any]) -> str:
    """Identify which event triggered the Lambda."""
    if "Records" in event and event["Records"]:
        record = event["Records"][0]
        event_source = record.get("eventSource") or record.get("EventSource")
        if event_source == "aws:sqs":
            # Inspect body to see if original caller was schedule or on-demand
            try:
                body = json.loads(record.get("body", "{}"))
                if body.get("source") == "schedule":
                    return "schedule"
                if body.get("source") in ("cli", "on-demand", "make"):
                    return "sqs"
            except Exception:
                pass
            return "sqs"
        if "s3" in record or event_source == "aws:s3":
            return "s3"

    if event.get("source") in ("schedule", "aws.events", "aws.scheduler"):
        return "schedule"

    if "source" in event:
        return str(event["source"])

    return "direct"


def get_default_week() -> str:
    """Return the previous ISO week string in Europe/Kyiv timezone (e.g. '2026-W40')."""
    tz_name = os.getenv("APP_TIMEZONE", "Europe/Kyiv")
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = datetime.timezone.utc
    now = datetime.datetime.now(tz)
    last_week = now - datetime.timedelta(days=7)
    year, week_num, _ = last_week.isocalendar()
    return f"{year}-W{week_num:02d}"


def builder_handler(event: dict[str, Any], context: Any = None) -> dict[str, Any]:
    """Lambda handler for report-builder (runs inside VPC, queries DB, writes to S3)."""
    trigger = detect_trigger(event)
    week = None

    if "Records" in event and event["Records"]:
        # Invocation from SQS
        try:
            body = json.loads(event["Records"][0]["body"])
            week = body.get("week")
        except Exception as exc:
            logger.warning(f"Could not parse SQS message body as JSON: {exc}")
    else:
        # Direct or Schedule invocation
        week = event.get("week")

    if not week:
        week = get_default_week()

    # Submission requirement: CloudWatch log line identifying the trigger and week
    logger.info(
        f"report-builder triggered: trigger={trigger} week={week}",
        extra={"trigger": trigger, "week": week},
    )

    logger.info(f"Querying database and generating report for week {week}...")
    csv_bytes = build_weekly_report(week)

    bucket = os.environ.get("REPORTS_BUCKET")
    if not bucket:
        raise ValueError("REPORTS_BUCKET environment variable is required")

    key = f"reports/{week}.csv"
    logger.info(f"Saving report ({len(csv_bytes)} bytes) to s3://{bucket}/{key}...")

    s3 = boto3.client("s3", region_name=os.getenv("AWS_REGION", "us-east-1"))
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=csv_bytes,
        ContentType="text/csv",
    )

    logger.info(f"Report successfully uploaded to s3://{bucket}/{key}")
    return {
        "statusCode": 200,
        "trigger": trigger,
        "week": week,
        "bucket": bucket,
        "key": key,
        "size_bytes": len(csv_bytes),
    }


# Alias for backward compatibility if template calls app.reports.lambda_handler.handler
handler = builder_handler


def mailer_handler(event: dict[str, Any], context: Any = None) -> dict[str, Any]:
    """Lambda handler for report-mailer (runs outside VPC, triggered by S3, sends SES email)."""
    records = event.get("Records", [])
    if not records:
        logger.warning("report-mailer received event without Records")
        return {"statusCode": 400, "message": "No records in event"}

    s3_info = records[0].get("s3")
    if not s3_info:
        logger.warning("No S3 event data found in record")
        return {"statusCode": 400, "message": "No S3 info in event"}

    bucket = s3_info["bucket"]["name"]
    key = urllib.parse.unquote_plus(s3_info["object"]["key"])

    # Submission requirement: CloudWatch log line identifying the trigger and key
    logger.info(
        f"report-mailer triggered: trigger=s3 key={key}",
        extra={"trigger": "s3", "key": key, "bucket": bucket},
    )

    # Safety guard: Never write into reports/ to avoid recursion loop
    filename = key.split("/")[-1]
    week = filename.replace(".csv", "")

    s3 = boto3.client("s3", region_name=os.getenv("AWS_REGION", "us-east-1"))
    logger.info(f"Downloading {key} from bucket {bucket}...")
    obj = s3.get_object(Bucket=bucket, Key=key)
    csv_content = obj["Body"].read()

    sender = os.environ.get("SENDER_EMAIL", "maksym.shkunda.25@cnu.edu.ua")
    recipient = os.environ.get("RECIPIENT_EMAIL", "maksym.shkunda.25@cnu.edu.ua")

    logger.info(f"Preparing email with attachment for {recipient}...")
    msg = EmailMessage()
    msg["Subject"] = f"Weekly Meetings Report — {week}"
    msg["From"] = sender
    msg["To"] = recipient

    body_text = (
        f"Hello,\n\n"
        f"Your automated weekly meetings report for {week} has been successfully generated.\n\n"
        f"Please find the complete CSV metrics and breakdown attached.\n\n"
        f"Generated by: Spry Meetings Automated Event-Driven Pipeline\n"
        f"S3 Location: s3://{bucket}/{key}\n"
    )
    msg.set_content(body_text)
    msg.add_attachment(
        csv_content,
        maintype="text",
        subtype="csv",
        filename=filename,
    )

    ses = boto3.client("ses", region_name=os.getenv("AWS_REGION", "us-east-1"))
    logger.info(f"Sending raw email via Amazon SES from {sender} to {recipient}...")
    response = ses.send_raw_email(
        Source=sender,
        Destinations=[recipient],
        RawMessage={"Data": msg.as_bytes()},
    )
    message_id = response.get("MessageId")
    logger.info(f"Email successfully delivered to SES, MessageId={message_id}")

    return {
        "statusCode": 200,
        "messageId": message_id,
        "recipient": recipient,
        "key": key,
    }
