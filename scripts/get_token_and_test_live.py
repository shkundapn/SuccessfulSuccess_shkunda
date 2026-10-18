"""Get real Cognito token and test live deployed Lambda function URL."""

import json
import os
import sys
import urllib.request
import urllib.error
import boto3
import dotenv

dotenv.load_dotenv(".env")

aws_region = os.getenv("AWS_REGION", "us-east-1")
idp = boto3.client(
    "cognito-idp",
    region_name=aws_region,
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    aws_session_token=os.getenv("AWS_SESSION_TOKEN"),
)

user_pool_id = "us-east-1_dLIUUyTHp"
client_id = "6s22d1p7brc05pss5gpkuvalnv"
username = "74f8a448-2001-7000-4744-df44d0abc178"
password = "Password123!Aa"

print("1. Setting permanent password for test user...")
idp.admin_set_user_password(
    UserPoolId=user_pool_id,
    Username=username,
    Password=password,
    Permanent=True,
)

print("2. Authenticating via admin_initiate_auth...")
auth_resp = idp.admin_initiate_auth(
    UserPoolId=user_pool_id,
    ClientId=client_id,
    AuthFlow="ADMIN_NO_SRP_AUTH",
    AuthParameters={
        "USERNAME": username,
        "PASSWORD": password,
    },
)

access_token = auth_resp["AuthenticationResult"]["AccessToken"]
id_token = auth_resp["AuthenticationResult"]["IdToken"]
print("Authentication successful! Got AccessToken and IdToken.")

url = "https://jevzoaxlk3frnqb5n2xgmsx5k40inznk.lambda-url.us-east-1.on.aws"

# Test input: Ukrainian example from introduction
test_text = (
    "Пн 10:00, синк по прайсингу, 45 хв. 1) нові тарифи Pro — Олена, 15 хв "
    "2) фідбек від клієнтів — Taras 3) що робимо з річною знижкою. "
    "Taras до п'ятниці збирає порівняння з конкурентами."
)

payload = {
    "text": test_text,
    "today": "2026-10-18",
    "tz": "Europe/Kyiv",
}

print(f"\n3. Calling live Lambda Function URL ({url})...")
req = urllib.request.Request(
    url,
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {access_token}",
    },
    method="POST",
)

try:
    with urllib.request.urlopen(req) as resp:
        body = resp.read().decode("utf-8")
        parsed = json.loads(body)
        print("Response HTTP 200 OK:")
        print(json.dumps(parsed, indent=2, ensure_ascii=False))
except urllib.error.HTTPError as e:
    err_body = e.read().decode("utf-8")
    print(f"HTTP Error {e.code}: {err_body}", file=sys.stderr)
    sys.exit(1)
