"""Part 4 Step 1: Check Bedrock connectivity and model calls (make llm-hello)."""

import os
import sys

import boto3
import dotenv

dotenv.load_dotenv(".env")
for key in ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "AWS_REGION"]:
    val = os.getenv(key)
    if val:
        os.environ[key] = val

aws_region = os.getenv("AWS_REGION", "us-east-1")
claude_model = os.getenv("PARSER_MODEL", "anthropic.claude-opus-5-5")

print("=== Part 1 / Step 1: Amazon Bedrock First Call Verification ===")
print(f"Region: {aws_region}\n")

# 1. Anthropic Messages API on Bedrock (bedrock-mantle)
print(f"1. Calling Anthropic Messages API on Bedrock (model: {claude_model})...")
try:
    from anthropic import AnthropicBedrockMantle

    client = AnthropicBedrockMantle(aws_region=aws_region)
    msg = client.messages.create(
        model=claude_model,
        max_tokens=1024,
        output_config={"effort": "low"},
        messages=[{"role": "user", "content": "In one sentence: what is an ISO week?"}],
    )
    print("Answer:", next(b.text for b in msg.content if b.type == "text"))
    print("Stop reason:", msg.stop_reason)
    print("Usage:", f"input_tokens={msg.usage.input_tokens}, output_tokens={msg.usage.output_tokens}\n")
except Exception as e:
    print(f"Anthropic Bedrock Mantle Notice: {e}")
    print("(Note: If Anthropic access is pending in your AWS Console under 'Bedrock -> Model access',")
    print("the Converse API below provides instant fallback inference.)\n")

# 2. Bedrock Converse API with Amazon Nova Micro (as detailed in Part 1, lines 90-99)
print("2. Calling Bedrock Converse API with Amazon Nova Micro (us.amazon.nova-micro-v1:0)...")
try:
    brt = boto3.client("bedrock-runtime", region_name=aws_region)
    resp = brt.converse(
        modelId="us.amazon.nova-micro-v1:0",
        messages=[{"role": "user", "content": [{"text": "In one sentence: what is an ISO week?"}]}],
        inferenceConfig={"maxTokens": 200},
    )
    print("Answer:", resp["output"]["message"]["content"][0]["text"])
    print("Usage:", resp.get("usage", {}))
    print("\n[OK] Bedrock verification SUCCESSFUL!")
except Exception as e:
    print(f"Converse API error: {e}", file=sys.stderr)
    sys.exit(1)
