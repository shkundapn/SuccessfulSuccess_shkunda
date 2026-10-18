"""Isolate which resource in infra/ai.yml fails EarlyValidation."""

import os
import boto3
import yaml
import dotenv

dotenv.load_dotenv(".env")
cf = boto3.client(
    "cloudformation",
    region_name="us-east-1",
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    aws_session_token=os.getenv("AWS_SESSION_TOKEN"),
)

with open("infra/ai.yml", "r", encoding="utf-8") as f:
    tpl = yaml.safe_load(f)

# Keep common parameters and outputs
params = [
    {"ParameterKey": "ProjectName", "ParameterValue": "spry-shkunda"},
    {"ParameterKey": "ImageUri", "ParameterValue": "783216615378.dkr.ecr.us-east-1.amazonaws.com/spry-shkunda-backend:latest"},
    {"ParameterKey": "CognitoUserPoolId", "ParameterValue": "us-east-1_dLIUUyTHp"},
    {"ParameterKey": "CognitoClientId", "ParameterValue": "6s22d1p7brc05pss5gpkuvalnv"},
]

all_resources = dict(tpl["Resources"])

# Test subsets
for r_name in all_resources.keys():
    test_tpl = {
        "AWSTemplateFormatVersion": tpl["AWSTemplateFormatVersion"],
        "Parameters": tpl["Parameters"],
        "Resources": {r_name: all_resources[r_name]},
    }
    # Replace refs/getatts to other resources with dummy strings if needed
    rendered = yaml.dump(test_tpl)
    # Simple substitution for dummy refs
    rendered = rendered.replace("!GetAtt AgendaParserRole.Arn", '"arn:aws:iam::123456789012:role/dummy"')
    rendered = rendered.replace("!GetAtt AgendaParserFunction.Arn", '"arn:aws:lambda:us-east-1:123456789012:function:dummy"')
    rendered = rendered.replace("!Ref AgendaParserFunction", '"dummy"')
    rendered = rendered.replace("!Ref LogGroup", '"/aws/lambda/dummy"')
    
    try:
        cs = cf.create_change_set(
            StackName="spry-shkunda-ai",
            ChangeSetName=f"test-{r_name.lower()}",
            TemplateBody=rendered,
            Parameters=params,
            Capabilities=["CAPABILITY_IAM"],
            ChangeSetType="CREATE",
        )
        import time
        time.sleep(2)
        desc = cf.describe_change_set(ChangeSetName=f"test-{r_name.lower()}", StackName="spry-shkunda-ai")
        status = desc.get("Status")
        reason = desc.get("StatusReason", "")
        print(f"Resource {r_name}: {status} - {reason}")
        cf.delete_change_set(ChangeSetName=f"test-{r_name.lower()}", StackName="spry-shkunda-ai")
    except Exception as e:
        print(f"Resource {r_name} exception: {e}")
