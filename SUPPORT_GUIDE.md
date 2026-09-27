# Spry / SuccessfulSuccess — Complete Deployment & Operations Guide

> **Quick Context for Agents & Engineers:**  
> This file is the single source of truth for the **SuccessfulSuccess (Spry)** project for student Petro Shkunda (`shkunda.pn@ucu.edu.ua`).  
> Reading this document gives full context on architecture decisions, active AWS infrastructure, configurations, submission assets, and operational commands.

---

## 1. Executive Summary & Lab Submission Package

### 1.1 Course Submission Details
* **Repository:** [https://github.com/shkundapn/SuccessfulSuccess_shkunda](https://github.com/shkundapn/SuccessfulSuccess_shkunda)
* **Frontend Custom Domain:** [https://successfulsuccess.pp.ua](https://successfulsuccess.pp.ua)
* **Dedicated Login URL:** [https://successfulsuccess.pp.ua/login/](https://successfulsuccess.pp.ua/login/)
* **Direct CloudFront Fallback URL:** [https://d1lbnhcst4jnzp.cloudfront.net](https://d1lbnhcst4jnzp.cloudfront.net)
* **Backend API Base URL (Lambda Function URL):** [https://omp54u5dee63qjrnyqz74wo42y0brxmp.lambda-url.us-east-1.on.aws](https://omp54u5dee63qjrnyqz74wo42y0brxmp.lambda-url.us-east-1.on.aws)
* **Interactive Swagger UI:** [https://omp54u5dee63qjrnyqz74wo42y0brxmp.lambda-url.us-east-1.on.aws/docs](https://omp54u5dee63qjrnyqz74wo42y0brxmp.lambda-url.us-east-1.on.aws/docs)
* **API Health Check:** [https://omp54u5dee63qjrnyqz74wo42y0brxmp.lambda-url.us-east-1.on.aws/health](https://omp54u5dee63qjrnyqz74wo42y0brxmp.lambda-url.us-east-1.on.aws/health)

### 1.2 Key Commits for Evaluation
* **Commit Adding Cognito & Infrastructure:**  
  [`557c76efaa810a1fb5a89aa54158bc7239816c98`](https://github.com/shkundapn/SuccessfulSuccess_shkunda/commit/557c76efaa810a1fb5a89aa54158bc7239816c98)  
  *(Adds `infra/auth.yml`, `frontend/components/auth-page.tsx`, `frontend/lib/auth.ts`, and backend JWT token verification)*
* **Commit Adding Pre-Sign-Up Auto-Confirm Lambda Trigger:**  
  [`ecd05924184a02094113bb7cec873e2429d713ac`](https://github.com/shkundapn/SuccessfulSuccess_shkunda/commit/ecd05924184a02094113bb7cec873e2429d713ac)
* **Commit Enabling Google Sign-In & Inlined Defaults:**  
  [`dc0ee555525c816f36ac2c867700ab83c0f171ce`](https://github.com/shkundapn/SuccessfulSuccess_shkunda/commit/dc0ee555525c816f36ac2c867700ab83c0f171ce)
* **Commit Adding Dedicated `/login/` Route:**  
  [`3c95237894a4c6a9a08404a80ce05f5ceb0f0254`](https://github.com/shkundapn/SuccessfulSuccess_shkunda/commit/3c95237894a4c6a9a08404a80ce05f5ceb0f0254)

---

## 2. Deployed AWS Infrastructure & Architecture

All resources are deployed in region **`us-east-1`** under AWS Account **`783216615378`** with project prefix **`spry-shkunda`**.

```
                           ┌───────────────────────────────────────────────┐
                           │   CloudFront CDN (EC75YMH5NWA7D)              │
                           │   - https://successfulsuccess.pp.ua           │
                           │   - https://d1lbnhcst4jnzp.cloudfront.net     │
                           └───────────────────────┬───────────────────────┘
                                                   │
                          ┌────────────────────────┴────────────────────────┐
                          ▼                                                 ▼
             ┌─────────────────────────┐                       ┌─────────────────────────┐
             │ Private S3 Static Bucket│                       │   AWS Cognito UserPool  │
             │ Next.js App Router Out  │                       │   us-east-1_dLIUUyTHp   │
             │ (/login, /today, etc.)  │                       │   (Cognito + Google IDP)│
             └─────────────────────────┘                       └────────────┬────────────┘
                                                                            │ (JWT Token)
                                                                            ▼
                                                               ┌─────────────────────────┐
                                                               │ AWS Lambda Backend API  │
                                                               │ (Container Image on ECR)│
                                                               └────────────┬────────────┘
                                                                            │
                                                                            ▼
                                                               ┌─────────────────────────┐
                                                               │ Amazon RDS PostgreSQL   │
                                                               │ db.t4g.micro (Free Tier)│
                                                               └─────────────────────────┘
```

### 2.1 Amazon Cognito (`spry-shkunda-auth`)
* **User Pool ID:** `us-east-1_dLIUUyTHp`
* **App Client ID:** `6s22d1p7brc05pss5gpkuvalnv`
* **Cognito OAuth Domain:** `spry-shkunda-783216615378.auth.us-east-1.amazoncognito.com`
* **Google Identity Provider:** Enabled (`SupportedIdentityProviders: [COGNITO, Google]`)
* **Google Redirect Callback:**  
  `https://spry-shkunda-783216615378.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`
* **Allowed Callback & Sign-out URLs:**  
  - `https://successfulsuccess.pp.ua/`
  - `https://d1lbnhcst4jnzp.cloudfront.net/`
  - `http://localhost:3000/`
* **Self Sign-Up:** Active (`AllowAdminCreateUserOnly: false`).
* **Pre-Sign-Up Lambda Trigger:** `spry-shkunda-auto-confirm` automatically marks all new signups as confirmed (`autoConfirmUser: true`, `autoVerifyEmail: true`), eliminating university firewall email delivery delays.

### 2.2 Backend & Database (`spry-shkunda-backend`)
* **Database:** Amazon RDS PostgreSQL 17 (`spry-shkunda-db`), instance class `db.t4g.micro`, 20 GB gp3 storage.
  - *Engineering Decision Note:* The original template used Aurora Serverless v2. The user's AWS account is flagged as a restricted "Free Plan" which requires `WithExpressConfiguration` (unsupported by CloudFormation). We swapped to standard RDS PostgreSQL `db.t4g.micro`, which is **100% Free Tier (750 free hours/month)** and creates zero billing overhead.
  - Endpoint: `spry-shkunda-db.c8jy8sci8vi3.us-east-1.rds.amazonaws.com:5432`
* **Compute:** AWS Lambda `spry-shkunda-backend` running Mangum + FastAPI in Docker container.
* **Function URL:** `https://omp54u5dee63qjrnyqz74wo42y0brxmp.lambda-url.us-east-1.on.aws`
* **ECR Repository:** `783216615378.dkr.ecr.us-east-1.amazonaws.com/spry-shkunda-backend:latest`
* **Migrations:** Database schema migrations applied via Alembic (`{"status": "migrated"}`).

### 2.3 Frontend & CDN (`spry-shkunda-frontend`)
* **CloudFront Distribution ID:** `EC75YMH5NWA7D`
* **CloudFront Domain:** `d1lbnhcst4jnzp.cloudfront.net`
* **S3 Static Bucket:** `spry-shkunda-frontend-783216615378`
* **ACM SSL Certificate:** `arn:aws:acm:us-east-1:783216615378:certificate/82a1b3ba-0576-4de2-bde0-2933e4d08f9a` (Status: `ISSUED` for `successfulsuccess.pp.ua`).
* **Custom Domain DNS:** Managed at `nic.ua`:
  - `successfulsuccess.pp.ua` CNAME `d1lbnhcst4jnzp.cloudfront.net`

---

## 3. Cost & Free Tier Tracking

**Total Current Cost: $0.00**

| Component | AWS Resource | Free Tier Status |
|---|---|---|
| **Database** | RDS PostgreSQL `db.t4g.micro` | 750 free hours/month + 20 GB free storage |
| **Compute** | AWS Lambda | 1,000,000 requests/month free forever |
| **CDN** | CloudFront | 1 TB data transfer + 10M requests free forever |
| **Auth** | Amazon Cognito | 50,000 monthly active users free forever |
| **Storage** | S3 (~5 MB) | 5 GB standard storage free |
| **SSL** | AWS Certificate Manager | 100% free for all public certificates |
| **Container Registry**| Amazon ECR (~250 MB) | 500 MB private storage free |
| **NAT Gateways** | *None deployed* | $0.00 (avoided expensive VPC NAT) |
| **DNS** | *nic.ua (external)* | $0.00 (saved $0.50/mo Route 53 zone fee) |

---

## 4. How to Build, Rebuild, and Deploy

### 4.1 Rebuilding & Deploying Frontend Changes
```powershell
# 1. Clean previous build caches
Remove-Item -Recurse -Force frontend/.next, frontend/out -ErrorAction SilentlyContinue

# 2. Build static export with Next.js Turbopack
npm --prefix frontend run build

# 3. Sync to S3 bucket
$aws = "C:\Users\StockPC\AppData\Local\Python\pythoncore-3.14-64\Scripts\aws.cmd"
& $aws s3 sync frontend/out s3://spry-shkunda-frontend-783216615378 --delete

# 4. Invalidate CloudFront CDN Cache
& $aws cloudfront create-invalidation --distribution-id EC75YMH5NWA7D --paths "/*"
```

### 4.2 Building & Pushing Backend Lambda Container
*Because the local host CPU has Intel VT-x virtualization disabled in BIOS, Docker Desktop cannot run locally.*  
Backend images are automatically built and pushed via GitHub Actions:
- Workflow file: [`.github/workflows/build-backend.yml`](file:///.github/workflows/build-backend.yml)
- Triggers on manual dispatch or push to `main` with changes in `backend/` or `infra/backend.yml`.
- Pushes directly to ECR: `783216615378.dkr.ecr.us-east-1.amazonaws.com/spry-shkunda-backend:latest`.

### 4.3 Applying Database Migrations
To run Alembic migrations on RDS directly via the Lambda function:
```powershell
$aws = "C:\Users\StockPC\AppData\Local\Python\pythoncore-3.14-64\Scripts\aws.cmd"
& $aws lambda invoke --function-name "spry-shkunda-backend" `
    --cli-binary-format raw-in-base64-out `
    --payload '{\"action\":\"migrate\"}' `
    response.json
Get-Content response.json
```

---

## 5. Teardown / Cleanup Instructions (After Grading)

When the lab is graded and you want to shut down all cloud resources:
```powershell
$aws = "C:\Users\StockPC\AppData\Local\Python\pythoncore-3.14-64\Scripts\aws.cmd"

# Empty the S3 static bucket first (CloudFormation requires empty bucket)
& $aws s3 rm s3://spry-shkunda-frontend-783216615378 --recursive

# Delete CloudFormation stacks in reverse order
& $aws cloudformation delete-stack --stack-name spry-shkunda-frontend
& $aws cloudformation delete-stack --stack-name spry-shkunda-backend
& $aws cloudformation delete-stack --stack-name spry-shkunda-auth
& $aws cloudformation delete-stack --stack-name spry-shkunda-ecr
```
