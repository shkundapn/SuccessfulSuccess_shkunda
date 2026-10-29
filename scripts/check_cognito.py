import os
import sys
import json
from pathlib import Path

env_file = Path(__file__).resolve().parent.parent / '.env'
if env_file.exists():
    with open(env_file, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                os.environ[k.strip()] = v.strip()

import boto3

user_pool_id = os.environ.get('COGNITO_USER_POOL_ID', 'us-east-1_dLIUUyTHp')
region = os.environ.get('AWS_REGION', 'us-east-1')

print(f"Checking Cognito User Pool: {user_pool_id} in {region}...")

client = boto3.client(
    'cognito-idp',
    region_name=region,
    aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'),
    aws_session_token=os.environ.get('AWS_SESSION_TOKEN') or None,
)

try:
    resp = client.list_user_pool_clients(UserPoolId=user_pool_id)
    clients = resp.get('UserPoolClients', [])
    if not clients:
        print("RESULT: NO_CLIENTS_FOUND (The user pool has 0 clients)")
    else:
        print(f"RESULT: FOUND {len(clients)} CLIENT(S):")
        for c in clients:
            print(f"  - ClientId: {c['ClientId']} (Name: {c.get('ClientName')})")
except Exception as e:
    print(f"ERROR: {e}")
