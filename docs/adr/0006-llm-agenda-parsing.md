# ADR 0006: LLM-Powered Agenda Parsing with Amazon Bedrock

- **Status**: Accepted
- **Date**: 2026-10-18
- **Author**: SuccessfulSuccess Team (Lab 6)
- **Deciders**: Software Architect, Backend Engineering, Security Lead

---

## 1. Context

Meetings rarely start from structured forms. Real-world agendas arrive as unformatted text: emails from managers, quick notes, or bullet points in team chats. 

We need an intuitive feature, **"Paste an agenda"**, allowing users to paste unstructured meeting notes and receive an accurately pre-filled agenda form that they can review, adjust, and save.

### Key Constraints
1. **Zero Idle Cost ($0.00)**: In accordance with our serverless architecture, components must incur $0 fixed cost when not handling traffic (no NAT Gateways, no idle VPC interface endpoints).
2. **Untrusted Outside Input**: Pasted text can contain arbitrary user content, including prompt injection attempts and instructions intended to hijack the model.
3. **User in Control ("Model Suggests, Person Decides")**: An AI model must never directly alter the database or execute state changes. The model suggests; the human verifies.
4. **Data Isolation & Tenant Security (FR-4)**: Meeting persistence must strictly respect Cognito-authenticated user tenancy.

---

## 2. Decision

1. **Dual-Engine Model Architecture**:
   - Primary: Anthropic Claude on Bedrock (`anthropic.claude-opus-5-5` or `anthropic.claude-haiku-5-5`) via the Messages API (`bedrock-mantle`).
   - Resilient Fallback: Amazon Nova Lite (`us.amazon.nova-lite-v1:0`) via the Bedrock Converse API (`bedrock-runtime`) ensuring uninterrupted operation across diverse AWS account entitlements.
   - Structured Output via Tool Use: The prompt forces output through the `record_agenda` tool schema (`ParsedAgenda` model), validated with Pydantic.

2. **Parser Runs Outside VPC**:
   - The agenda parser is implemented as a dedicated AWS Lambda function (`spry-shkunda-agenda-parser`) with a public Lambda Function URL (`AuthType: NONE`).
   - The Lambda runs **outside the VPC**, enabling it to call Amazon Bedrock and fetch Cognito JWKS directly over the internet with zero NAT Gateway ($32+/mo) and zero VPC PrivateLink interface endpoints ($7.30/mo).

3. **Authentication & Rate Limits at Edge**:
   - The Lambda Function URL verifies incoming Cognito Access/ID JWTs against Cognito JWKS. Unauthenticated requests are immediately rejected with `401 Unauthorized`.
   - Text inputs exceeding 10,000 characters are rejected with `413 Payload Too Large` before calling foundation models.

4. **Model Never Writes to Database**:
   - The parser function is completely read-only with zero database credentials or VPC access.
   - The browser receives the structured JSON suggestion, displays a pre-filled form with interactive "suggested" badges, and allows human editing.
   - Persisting the agenda requires the user to click **Save**, which routes through the standard VPC API endpoint (`POST /meetings/{id}/agenda`), validating user ownership and recording `ai_suggestion` for feedback auditing.

---

## 3. Architecture & Data Flow

```
[ Browser / Client ]
       │
       ├────── 1. POST text, today, tz (with Cognito JWT) ──────► [ Lambda Parser (outside VPC) ]
       │                                                                      │
       │                                                                      ▼
       │                                                           [ Amazon Bedrock LLM ]
       │                                                          (Claude Opus 5.5 / Nova)
       │◄───── 2. Return Parsed JSON (suggestions) ───────────────────────────┘
       │
  (Human checks, edits field)
       │
       └────── 3. POST /meetings/{id}/agenda (final + suggestion) ──► [ Backend API (VPC) ]
                                                                             │
                                                                             ▼
                                                                  [ Aurora PostgreSQL ]
```

---

## 4. Alternatives Considered

| Alternative | Reason It Lost |
| :--- | :--- |
| **Call Bedrock from VPC Backend API via VPC Endpoint** | A VPC interface endpoint for Bedrock costs ~$7.30/month continuously ($0.01/hr), violating our zero-idle-cost requirement. When nobody uses the app, it still generates a non-zero monthly bill. |
| **Call Bedrock from VPC Backend API via NAT Gateway** | An AWS NAT Gateway costs ~$32+/month plus data transfer fees, which is completely excessive for a student/serverless project. |
| **Call Anthropic Claude API directly over Internet** | Requires storing third-party API keys, introduces separate billing, and bypasses AWS IAM role-based access control, CloudWatch metrics, and AWS Budgets. |
| **Plain Regex / Rule-Based Parser** | Fails completely on Ukrainian and natural language syntax, relative date semantics ("next Tuesday after lunch", "до п'ятниці"), and arbitrary note formats. |
| **Let Model Call a `save_agenda` Tool Directly** | A prompt injection attack could overwrite data or assign unauthorized owners without human oversight. Allowing autonomous writes breaks the fundamental human-in-the-loop guarantee. |

---

## 5. Consequences

### Positive
- **Zero Fixed Idle Cost**: Incurs $0.00 when no agendas are parsed.
- **Pay-Per-Token**: A single parse costs ~$0.007 – $0.016 with Claude Opus 5.5, and ~$0.0004 with Claude Haiku / Nova.
- **Full Auditability**: Every parse emits a structured JSON log to CloudWatch with `user`, `model`, `prompt_version`, `input_tokens`, `output_tokens`, `latency_ms`, and `cost_usd`.
- **Continuous Quality Feedback**: Storing `ai_suggestion` next to final `agenda` allows calculating human correction rates and comparing prompt versions.
- **Graceful Degradation**: If Amazon Bedrock is temporarily unavailable or throttled, all core Spry functionality continues working, and users can simply type/edit their agenda manually.

### Trade-offs & Mitigations
- **Latency**: Parsing takes 1.5–4.5 seconds. Mitigated by an active progress indicator and an `AbortController` cancel button in the UI.
- **Prompt Injection Vulnerability**: Mitigated by strict separation of concerns (the parser has zero write permissions; persistence requires explicit user authentication and action).
