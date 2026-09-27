# Spry / SuccessfulSuccess — Project Context & Support Guide

This file provides full context and status of the project so that any subsequent session or agent can immediately resume work without re-discovering the setup.

---

## 1. Project Background & Course Labs

This project is the **Spry / SuccessfulSuccess** meetings management application across three university course labs:

- **Lab 1 — The Monorepo Foundation:**
  - Structure: Monorepo containing `backend/`, `frontend/`, and `infra/`.
  - Backend: FastAPI, SQLAlchemy 2 (async), Alembic for migrations, PostgreSQL 17.
  - Frontend: Next.js 16 (App Router) + shadcn/ui + Tailwind CSS.
  - Local startup: Runs with a single command: `docker compose up --build`.

- **Lab 2 — Classic AWS Deployment:**
  - Deployed via ECS Fargate task behind an Application Load Balancer (ALB), an RDS PostgreSQL (`db.t3.micro`) database, and S3 + CloudFront for static frontend.
  - Bill: Around $52/month idle due to ALB, public IPv4 addresses, and continuous compute.

- **Lab 3 — Serverless Migration & Cognito Authentication (CURRENT STATE):**
  - **Compute:** Fargate + ALB replaced with **AWS Lambda container image** via **Function URL** (`https://<id>.lambda-url.us-east-1.on.aws`) using [Mangum](https://github.com/Kludex/mangum). Idle cost = $0.
  - **Database:** RDS replaced with **Aurora Serverless v2** PostgreSQL (0–1 ACU, pauses after 5 idle minutes).
  - **Frontend:** Private S3 bucket + CloudFront with Origin Access Control (OAC), WAF web ACL, subscribed to CloudFront Free Plan ($0/month). Clean URLs handled via CloudFront Function.
  - **Auth:** AWS Cognito User Pool (`infra/auth.yml`): Managed login version 2, self sign-up, email verification, PKCE flow via `@tanstack/react-query` and AWS Amplify / OIDC in Next.js.
  - **API Token Verification:** Backend verifies Cognito JWT access tokens using cached JWKS (`backend/app/auth.py`).
  - **Region:** Single region: `us-east-1`.

---

## 2. Local Environment & Toolchain State

All tools have been installed in the user's profile and permanently added to the User `PATH` environment variable:

| Tool | Version | Path / Location | Status |
|---|---|---|---|
| **Git** | `2.55.0` | `C:\Users\StockPC\AppData\Local\Programs\Git\cmd\git.exe` | Ready |
| **GitHub CLI (`gh`)** | `2.101.0` | `C:\Users\StockPC\AppData\Local\Programs\gh\bin\gh.exe` | Ready (needs `gh auth login` or manual fork) |
| **Node.js** | `v24.21.0` | `C:\Users\StockPC\AppData\Local\Programs\nodejs\node.exe` | Ready |
| **npm** | `11.19.0` | `C:\Users\StockPC\AppData\Local\Programs\nodejs\npm.cmd` | Ready (PowerShell RemoteSigned policy set) |
| **Python** | `3.14.7` | `C:\Users\StockPC\AppData\Local\Python\pythoncore-3.14-64\python.exe` | Ready |
| **AWS CLI** | `1.46.1` | `C:\Users\StockPC\AppData\Local\Python\pythoncore-3.14-64\Scripts\aws.cmd` | Ready |
| **Docker Desktop** | Not installed / Not running | Needs Docker Desktop installed on Windows | Required for local `docker compose` & Lambda image build |

---

## 3. Repository Layout & Key Files

Current working directory: `C:\Users\StockPC\Desktop\shkunda_work\oles_viber_code`

```text
oles_viber_code/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routers (/api/v1/meetings, /api/v1/users, /api/v1/me)
│   │   ├── auth.py       # Cognito JWT verification & cached JWKS
│   │   ├── config.py     # Pydantic Settings
│   │   ├── lambda_handler.py # Mangum handler for AWS Lambda & direct migration invocation
│   │   ├── models/       # SQLAlchemy ORM models (User, Meeting, Participant)
│   │   ├── repositories/ # Database query operations
│   │   ├── schemas/      # Pydantic request/response schemas
│   │   └── services/     # Business logic
│   ├── migrations/       # Alembic migrations (0001_init, 0002_users_and_meeting_owner)
│   ├── tests/            # Pytest test suite
│   ├── Dockerfile        # Local development / compose container
│   ├── Dockerfile.lambda # AWS Lambda container image
│   └── pyproject.toml    # Python dependencies (fastapi, mangum, sqlalchemy, pyjwt)
├── frontend/
│   ├── app/              # Next.js App Router ((app)/meetings, /today, /login)
│   ├── components/       # shadcn/ui components, auth-provider, user-menu, require-auth
│   ├── lib/              # api.ts (HTTP client with Bearer token), auth.ts
│   ├── Dockerfile        # Production / compose build
│   └── package.json      # Dependencies (next 16, react 19, aws-amplify, tailwind 4)
├── infra/
│   ├── auth.yml          # CloudFormation: Cognito UserPool, UserPoolClient, ManagedLogin
│   ├── backend.yml       # CloudFormation: Lambda Function URL, Aurora Serverless v2, SG, IAM
│   ├── frontend.yml      # CloudFormation: S3 bucket, CloudFront, OAC, WAF Web ACL
│   ├── ecr.yml           # CloudFormation: ECR Repository for backend Lambda container
│   └── certificate.sh    # ACM certificate request and validation helper
├── .env.example          # Template for environment variables
├── .env                  # Local config (created, ready for user credentials)
├── docker-compose.yml    # Compose definition: postgres, backend, frontend
├── Makefile              # Deployment and task automation targets
├── README.md             # Comprehensive project documentation and guides
├── SPEC.md               # API, UI, and data model specification
└── SUPPORT_GUIDE.md      # This file
```

---

## 4. Immediate Next Steps & How to Proceed

### Step 1: Link to User's GitHub Fork
1. The user creates a fork of `https://github.com/dobosevych/SuccessfulSuccess` on their GitHub account.
2. In the repository folder, point `origin` to the new fork:
   ```powershell
   git remote set-url origin https://github.com/<YOUR_GITHUB_USERNAME>/<REPO_NAME>.git
   git push -u origin main
   ```
   *(Alternatively, run `gh auth login` and `gh repo fork dobosevych/SuccessfulSuccess --clone=false`).*

### Step 2: Configure AWS Credentials in `.env`
Edit `C:\Users\StockPC\Desktop\shkunda_work\oles_viber_code\.env`:
```ini
AWS_ACCESS_KEY_ID=<your-iam-access-key>
AWS_SECRET_ACCESS_KEY=<your-iam-secret-key>
AWS_REGION=us-east-1
PROJECT_NAME=<unique-short-name-e.g-spry-myname>
AWS_DB_PASSWORD=<secure-8-to-41-char-password>
AWS_CLOUDFRONT_PLAN=FREE
```

### Step 3: Run / Deploy
Once Docker Desktop and AWS credentials are in place:
1. **Verify AWS Connection**:
   ```bash
   make aws-whoami
   ```
2. **Deploy to AWS (Full Stack)**:
   ```bash
   make aws-deploy
   ```
   This orchestrates:
   - `make aws-deploy-auth`: Creates Cognito User Pool.
   - `make aws-deploy-backend`: Builds Lambda image, pushes to ECR, provisions Aurora v2, runs migrations.
   - `make aws-deploy-frontend`: Builds Next.js static export with backend API URL, syncs to S3, invalidates CloudFront.
3. **Get URLs**:
   ```bash
   make aws-frontend-url  # CloudFront site URL
   make aws-url           # Backend Lambda function URL (/docs, /health)
   ```

---

## 5. Course Submission Checklist

- [ ] **Repository Link**: Pushed to student's personal GitHub account (lecturer given access if private).
- [ ] **Running App Screenshot**: Frontend list of meetings running either locally or in cloud with user signed in.
- [ ] **Frontend URL**: Reachable over HTTPS (`https://<id>.cloudfront.net` or custom domain).
- [ ] **Backend URL**: Reachable over HTTPS (`https://<id>.lambda-url.us-east-1.on.aws`).
- [ ] **Login URL**: `https://<frontend-url>/login/` (opens Cognito managed login, self-signup enabled).
- [ ] **Signed-In Screenshot**: Showing the user's email in the frontend header.
