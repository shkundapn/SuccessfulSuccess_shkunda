"""AWS Lambda entrypoint for the agenda-parser function URL."""

import asyncio
import json
import logging
import time
from datetime import date
from typing import Any

from app.ai.agenda import PROMPT_VERSION, AgendaParseError, cost_usd, parse_agenda
from app.auth import AuthError, AuthNotConfiguredError, CurrentUser, get_verifier
from app.config import settings

log = logging.getLogger(__name__)
log.setLevel(logging.INFO)


def _get_cors_headers(origin: str | None = None) -> dict[str, str]:
    """Build CORS headers for Lambda Function URL responses."""
    allowed_origins = settings.cors_origin_list
    allow_origin = "*"
    if origin and allowed_origins:
        if "*" in allowed_origins or origin in allowed_origins:
            allow_origin = origin
        else:
            allow_origin = allowed_origins[0]

    return {
        "content-type": "application/json",
        "access-control-allow-origin": allow_origin,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "Authorization, Content-Type, X-Amz-Date, X-Api-Key",
        "access-control-max-age": "86400",
    }


def verify_cognito_token(auth_header: str) -> CurrentUser:
    """Verifies access or ID token from Authorization header using Cognito JWKS."""
    if not auth_header:
        raise AuthError("Authorization header is missing")

    token = auth_header.replace("Bearer ", "").replace("bearer ", "").strip()
    if not token:
        raise AuthError("Token is empty")

    async def _verify() -> CurrentUser:
        verifier = get_verifier()
        try:
            return await verifier.verify(token)
        except Exception:
            # Fallback to ID token if access token verification fails
            claims = await verifier.verify_id_token(token)
            return CurrentUser(
                sub=claims["sub"],
                username=claims.get("cognito:username") or claims.get("email"),
            )

    try:
        return asyncio.run(_verify())
    except (AuthError, AuthNotConfiguredError) as e:
        raise AuthError(str(e)) from e
    except Exception as e:
        raise AuthError(f"Token verification failed: {e}") from e


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Lambda function URL handler for agenda parsing."""
    headers = event.get("headers") or {}
    # Lowercase headers for consistent lookup
    norm_headers = {k.lower(): v for k, v in headers.items()}
    origin = norm_headers.get("origin")
    cors_headers = _get_cors_headers(origin)

    # Handle CORS preflight OPTIONS request
    http_method = (
        event.get("requestContext", {}).get("http", {}).get("method")
        or event.get("httpMethod")
        or ""
    ).upper()

    if http_method == "OPTIONS":
        return {
            "statusCode": 204,
            "headers": cors_headers,
            "body": "",
        }

    # Step 1: Authenticate the user
    auth_header = norm_headers.get("authorization", "")
    try:
        user = verify_cognito_token(auth_header)
    except AuthError as e:
        return {
            "statusCode": 401,
            "headers": cors_headers,
            "body": json.dumps({"error": f"Unauthorized: {e}"}),
        }

    # Step 2: Parse request body
    raw_body = event.get("body", "{}")
    if event.get("isBase64Encoded", False):
        import base64

        raw_body = base64.b64decode(raw_body).decode("utf-8")

    try:
        body = json.loads(raw_body) if isinstance(raw_body, str) else raw_body
    except Exception as e:
        return {
            "statusCode": 400,
            "headers": cors_headers,
            "body": json.dumps({"error": f"Invalid JSON body: {e}"}),
        }

    text = body.get("text", "")

    # Step 3: Enforce 10,000 character limit
    if len(text) > 10000:
        return {
            "statusCode": 413,
            "headers": cors_headers,
            "body": json.dumps(
                {
                    "error": (
                        f"Pasted text exceeds maximum allowed limit of 10,000 characters "
                        f"(got {len(text)} characters)."
                    )
                }
            ),
        }

    if not text.strip():
        return {
            "statusCode": 400,
            "headers": cors_headers,
            "body": json.dumps({"error": "Pasted text cannot be empty."}),
        }

    # Resolve date and timezone
    try:
        today_val = date.fromisoformat(body["today"]) if "today" in body else date.today()
    except Exception:
        today_val = date.today()

    tz_val = body.get("tz") or settings.app_timezone
    model_val = body.get("model") or settings.parser_model

    started = time.monotonic()
    try:
        agenda, usage = parse_agenda(text=text, today=today_val, tz=tz_val, model=model_val)
    except AgendaParseError as e:
        return {
            "statusCode": 422,
            "headers": cors_headers,
            "body": json.dumps({"error": str(e)}),
        }
    except Exception as e:
        log.exception("Unexpected error parsing agenda: %s", e)
        return {
            "statusCode": 500,
            "headers": cors_headers,
            "body": json.dumps({"error": f"Server error: {e}"}),
        }

    latency_ms = int((time.monotonic() - started) * 1000)
    actual_model = usage.get("model", model_val)
    cost = cost_usd(actual_model, usage)

    # Emit structured JSON log for CloudWatch (Submission item 4)
    log_payload = {
        "event": "agenda_parsed",
        "user": user.sub,
        "model": actual_model,
        "prompt_version": PROMPT_VERSION,
        "input_tokens": usage.get("input_tokens", 0),
        "output_tokens": usage.get("output_tokens", 0),
        "latency_ms": latency_ms,
        "cost_usd": cost,
    }
    log.info(json.dumps(log_payload))

    return {
        "statusCode": 200,
        "headers": cors_headers,
        "body": json.dumps(
            {
                "agenda": agenda.model_dump(mode="json"),
                "model": actual_model,
                "prompt_version": PROMPT_VERSION,
                "usage": usage,
                "cost_usd": cost,
                "latency_ms": latency_ms,
            }
        ),
    }
