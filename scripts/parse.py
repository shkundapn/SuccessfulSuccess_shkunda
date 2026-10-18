"""CLI runner for testing agenda parsing locally (make parse TEXT="...")."""

from datetime import date
import json
import os
import sys

import dotenv

# Load environment variables
dotenv.load_dotenv(".env")
for k in ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "AWS_REGION"]:
    if os.getenv(k):
        os.environ[k] = os.getenv(k)

# Ensure backend package is in python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.ai.agenda import cost_usd, parse_agenda
from app.config import settings


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1].strip():
        text = sys.argv[1].strip()
    else:
        text = os.getenv(
            "TEXT",
            (
                "Пн 10:00, синк по прайсингу, 45 хв. 1) нові тарифи Pro — Олена, 15 хв "
                "2) фідбек від клієнтів — Taras 3) що робимо з річною знижкою. "
                "Taras до п'ятниці збирає порівняння з конкурентами."
            ),
        )

    today = date.today()
    tz = settings.app_timezone

    print(f"--- Parsing with model: {settings.parser_model} (date={today}, tz={tz}) ---")
    try:
        agenda, usage = parse_agenda(text=text, today=today, tz=tz)
        print("\n--- Parsed Agenda JSON ---")
        print(json.dumps(agenda.model_dump(mode="json"), indent=2, ensure_ascii=False))

        cost = cost_usd(settings.parser_model, usage)
        print("\n--- Token Usage & Cost ---")
        print(
            f"Input tokens: {usage.get('input_tokens')}, "
            f"Output tokens: {usage.get('output_tokens')}, "
            f"Estimated cost: ${cost:.6f}"
        )
    except Exception as e:
        print(f"Error parsing agenda: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
