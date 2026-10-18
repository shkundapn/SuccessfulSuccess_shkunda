"""Helper script to build and push the backend Lambda Docker image to ECR."""

import base64
import os
import subprocess
import sys
import boto3
import dotenv

dotenv.load_dotenv(".env")

aws_region = os.getenv("AWS_REGION", "us-east-1")
ecr = boto3.client(
    "ecr",
    region_name=aws_region,
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    aws_session_token=os.getenv("AWS_SESSION_TOKEN"),
)

print("1. Getting ECR authorization token...")
auth_data = ecr.get_authorization_token()["authorizationData"][0]
token = base64.b64decode(auth_data["authorizationToken"]).decode("utf-8").split(":")[1]
proxy_endpoint = auth_data["proxyEndpoint"]
registry = proxy_endpoint.replace("https://", "")

print(f"2. Logging in to Docker registry {registry}...")
login_proc = subprocess.run(
    ["docker", "login", "--username", "AWS", "--password-stdin", registry],
    input=token,
    capture_output=True,
    text=True,
    check=False,
)
if login_proc.returncode != 0:
    print(f"Docker login failed: {login_proc.stderr}", file=sys.stderr)
    sys.exit(1)
print("Docker login succeeded.")

repo_tag = f"{registry}/spry-shkunda-backend:latest"

print(f"3. Building Docker image {repo_tag} (platform linux/amd64)...")
build_cmd = [
    "docker",
    "build",
    "--platform",
    "linux/amd64",
    "--provenance=false",
    "-f",
    "backend/Dockerfile.lambda",
    "-t",
    repo_tag,
    "./backend",
]
build_proc = subprocess.run(build_cmd, check=False)
if build_proc.returncode != 0:
    print(f"Docker build failed with code {build_proc.returncode}", file=sys.stderr)
    sys.exit(1)
print("Docker build succeeded.")

print(f"4. Pushing Docker image {repo_tag} to ECR...")
push_cmd = ["docker", "push", repo_tag]
push_proc = subprocess.run(push_cmd, check=False)
if push_proc.returncode != 0:
    print(f"Docker push failed with code {push_proc.returncode}", file=sys.stderr)
    sys.exit(1)
print("Docker push succeeded.")
