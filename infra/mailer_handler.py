import json, os, urllib.parse, boto3, logging
from email.message import EmailMessage

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    records = event.get("Records", [])
    if not records:
        return {"statusCode": 400, "body": "No records"}
    s3_info = records[0].get("s3", {})
    bucket = s3_info.get("bucket", {}).get("name")
    key = urllib.parse.unquote_plus(s3_info.get("object", {}).get("key", ""))

    # Required CloudWatch log line for lab submission
    logger.info(f"report-mailer triggered: trigger=s3 key={key}")

    filename = key.split("/")[-1]
    week = filename.replace(".csv", "")

    s3 = boto3.client("s3")
    obj = s3.get_object(Bucket=bucket, Key=key)
    csv_content = obj["Body"].read()

    sender = os.environ.get("SENDER_EMAIL", "maksym.shkunda.25@cnu.edu.ua")
    recipient = os.environ.get("RECIPIENT_EMAIL", "maksym.shkunda.25@cnu.edu.ua")

    msg = EmailMessage()
    msg["Subject"] = f"Weekly Meetings Report — {week}"
    msg["From"] = sender
    msg["To"] = recipient
    msg.set_content(
        f"Hello,\n\n"
        f"Your weekly meetings report for {week} has been successfully generated.\n\n"
        f"Report file: {filename}\n"
        f"S3 location: s3://{bucket}/{key}\n\n"
        f"Attached is the full CSV breakdown.\n\n"
        f"Best regards,\nSpry Meetings Pipeline"
    )
    msg.add_attachment(csv_content, maintype="text", subtype="csv", filename=filename)

    ses = boto3.client("ses", region_name=os.environ.get("AWS_REGION", "us-east-1"))
    resp = ses.send_raw_email(
        Source=sender,
        Destinations=[recipient],
        RawMessage={"Data": msg.as_bytes()}
    )
    logger.info(f"Email sent successfully to {recipient}, MessageId={resp.get('MessageId')}")
    return {"statusCode": 200, "messageId": resp.get("MessageId")}
