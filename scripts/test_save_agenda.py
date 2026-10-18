"""Test saving an agenda and AI suggestion via POST /api/v1/meetings/{id}/agenda."""

import json
import os
import sys
import urllib.request
import urllib.error
import boto3
import dotenv

dotenv.load_dotenv(".env")

# 1. Authenticate with Cognito
idp = boto3.client(
    "cognito-idp",
    region_name="us-east-1",
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    aws_session_token=os.getenv("AWS_SESSION_TOKEN"),
)

auth_resp = idp.admin_initiate_auth(
    UserPoolId="us-east-1_dLIUUyTHp",
    ClientId="6s22d1p7brc05pss5gpkuvalnv",
    AuthFlow="ADMIN_NO_SRP_AUTH",
    AuthParameters={
        "USERNAME": "74f8a448-2001-7000-4744-df44d0abc178",
        "PASSWORD": "Password123!Aa",
    },
)

token = auth_resp["AuthenticationResult"]["AccessToken"]
id_token = auth_resp["AuthenticationResult"]["IdToken"]

api_base = "https://omp54u5dee63qjrnyqz74wo42y0brxmp.lambda-url.us-east-1.on.aws"

def request_api(method: str, path: str, payload: dict | None = None) -> dict:
    url = f"{api_base}{path}"
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8")
        print(f"API Error ({e.code}) on {method} {path}: {err}", file=sys.stderr)
        raise

# 2. Sync profile first
try:
    request_api("POST", "/api/v1/me/sync", {"id_token": id_token})
except Exception:
    pass

# 3. List or create meeting
meetings = request_api("GET", "/api/v1/meetings")
if meetings.get("items"):
    meeting_id = meetings["items"][0]["id"]
    print(f"Using existing meeting: {meeting_id}")
else:
    print("Creating test meeting...")
    new_m = request_api(
        "POST",
        "/api/v1/meetings",
        {
            "name": "Sync with Management",
            "description": "Weekly alignment meeting",
            "starts_at": "2026-10-21T10:00:00+03:00",
            "ends_at": "2026-10-21T10:45:00+03:00",
            "participants": [{"name": "Maksym Shkunda", "email": "maksym.shkunda.25@cnu.edu.ua"}],
        },
    )
    meeting_id = new_m["id"]
    print(f"Created new meeting: {meeting_id}")

# 4. Save Agenda via POST /api/v1/meetings/{id}/agenda
agenda_payload = {
    "agenda": {
        "title": "Pricing Sync (Reviewed)",
        "duration_minutes": 45,
        "items": [
            {"topic": "Нові тарифи Pro", "owner": "Олена", "minutes": 15},
            {"topic": "Фідбек від клієнтів", "owner": "Taras", "minutes": None},
            {"topic": "Що робимо з річною знижкою", "owner": None, "minutes": None},
        ],
        "action_items": [
            {"task": "Зібрати порівняння з конкурентами", "owner": "Taras", "due": "2026-10-23"}
        ],
    },
    "ai_suggestion": {
        "title": None,
        "duration_minutes": 45,
        "items": [
            {"topic": "Нові тарифи Pro", "owner": "Олена", "minutes": 15},
            {"topic": "Фідбек від клієнтів", "owner": "Taras", "minutes": None},
        ],
    },
    "model": "anthropic.claude-opus-5-5",
    "prompt_version": "agenda-v1",
}

print(f"\nCalling POST /api/v1/meetings/{meeting_id}/agenda...")
updated_meeting = request_api("POST", f"/api/v1/meetings/{meeting_id}/agenda", agenda_payload)
print("Save succeeded! Response:")
print(f"Meeting Name: {updated_meeting['name']}")
print(f"Agenda Title: {updated_meeting.get('agenda', {}).get('title')}")
print(f"Agenda Items count: {len(updated_meeting.get('agenda', {}).get('items', []))}")
print(f"AI Suggestion stored: {bool(updated_meeting.get('ai_suggestion'))}")
print(f"AI Model: {updated_meeting.get('ai_suggestion', {}).get('model')}")

print("\nVerifying with GET /api/v1/meetings/{id}...")
fetched = request_api("GET", f"/api/v1/meetings/{meeting_id}")
assert fetched.get("agenda") is not None, "Agenda was not persisted!"
assert fetched.get("ai_suggestion") is not None, "ai_suggestion was not persisted!"
print("[OK] Agenda persistence verified end-to-end!")
