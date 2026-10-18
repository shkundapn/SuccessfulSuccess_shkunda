import os
import boto3
import dotenv

dotenv.load_dotenv(".env")
cf = boto3.client(
    "cloudformation",
    region_name=os.getenv("AWS_REGION", "us-east-1"),
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    aws_session_token=os.getenv("AWS_SESSION_TOKEN"),
)

events = cf.describe_stack_events(StackName="spry-shkunda-ai")["StackEvents"]
for e in reversed(events):
    print(f"{e['LogicalResourceId']} ({e.get('ResourceType', '')}): {e['ResourceStatus']} | {e.get('ResourceStatusReason', '')}")
