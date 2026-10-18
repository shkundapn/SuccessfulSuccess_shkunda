"""Deploy the agenda-parser CloudFormation stack (spry-shkunda-ai)."""

import os
import sys
import boto3
import dotenv

dotenv.load_dotenv(".env")

aws_region = os.getenv("AWS_REGION", "us-east-1")
cf = boto3.client(
    "cloudformation",
    region_name=aws_region,
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    aws_session_token=os.getenv("AWS_SESSION_TOKEN"),
)

stack_name = "spry-shkunda-ai"
template_path = "infra/ai.yml"

with open(template_path, "r", encoding="utf-8") as f:
    template_body = f.read()

parameters = [
    {"ParameterKey": "ProjectName", "ParameterValue": "spry-shkunda"},
    {
        "ParameterKey": "ImageUri",
        "ParameterValue": "783216615378.dkr.ecr.us-east-1.amazonaws.com/spry-shkunda-backend:latest",
    },
    {"ParameterKey": "CognitoUserPoolId", "ParameterValue": "us-east-1_dLIUUyTHp"},
    {"ParameterKey": "CognitoClientId", "ParameterValue": "6s22d1p7brc05pss5gpkuvalnv"},
    {"ParameterKey": "CorsOrigins", "ParameterValue": "*"},
    {"ParameterKey": "ParserModel", "ParameterValue": "amazon.nova-lite-v1:0"},
    {"ParameterKey": "AppTimezone", "ParameterValue": "Europe/Kyiv"},
]

tags = [
    {"Key": "PROJECT_NAME", "Value": "spry-shkunda"},
]

print(f"Deploying CloudFormation stack {stack_name}...")
try:
    cf.describe_stacks(StackName=stack_name)
    exists = True
except cf.exceptions.ClientError:
    exists = False

if exists:
    print(f"Updating existing stack {stack_name}...")
    try:
        cf.update_stack(
            StackName=stack_name,
            TemplateBody=template_body,
            Parameters=parameters,
            Capabilities=["CAPABILITY_IAM"],
            Tags=tags,
        )
        waiter = cf.get_waiter("stack_update_complete")
        waiter.wait(StackName=stack_name)
    except cf.exceptions.ClientError as e:
        if "No updates are to be performed" in str(e):
            print("No updates needed.")
        else:
            raise
else:
    print(f"Creating new stack {stack_name}...")
    cf.create_stack(
        StackName=stack_name,
        TemplateBody=template_body,
        Parameters=parameters,
        Capabilities=["CAPABILITY_IAM"],
        Tags=tags,
    )
    waiter = cf.get_waiter("stack_create_complete")
    waiter.wait(StackName=stack_name)

print("Stack deployed successfully!")
stack = cf.describe_stacks(StackName=stack_name)["Stacks"][0]
for output in stack.get("Outputs", []):
    print(f"  {output['OutputKey']}: {output['OutputValue']}")
