# Lab Submission & Verification Report: Authentication & Deployment

**Student:** Petro Shkunda (`shkunda.pn@ucu.edu.ua`)  
**Project:** SuccessfulSuccess (Meetings)  
**Date:** September 30, 2026  

---

## 1. Submission Overview & Required Links

### 1.1 Deployed Endpoints (HTTPS on Custom Domain)
* **Dedicated Login URL:**  
  [https://successfulsuccess.pp.ua/login/](https://successfulsuccess.pp.ua/login/)  
  *(Supports both Email/Password sign-in/sign-up and federated "Continue with Google")*
* **Frontend Application URL (Custom Domain):**  
  [https://successfulsuccess.pp.ua](https://successfulsuccess.pp.ua)  
* **Direct CloudFront Fallback:**  
  [https://d1lbnhcst4jnzp.cloudfront.net](https://d1lbnhcst4jnzp.cloudfront.net)  
* **Backend API Base URL (AWS Lambda Function URL):**  
  [https://omp54u5dee63qjrnyqz74wo42y0brxmp.lambda-url.us-east-1.on.aws](https://omp54u5dee63qjrnyqz74wo42y0brxmp.lambda-url.us-east-1.on.aws)  
* **Interactive Swagger UI (OpenAPI Docs):**  
  [https://omp54u5dee63qjrnyqz74wo42y0brxmp.lambda-url.us-east-1.on.aws/docs](https://omp54u5dee63qjrnyqz74wo42y0brxmp.lambda-url.us-east-1.on.aws/docs)  
* **API Health Check:**  
  [https://omp54u5dee63qjrnyqz74wo42y0brxmp.lambda-url.us-east-1.on.aws/health](https://omp54u5dee63qjrnyqz74wo42y0brxmp.lambda-url.us-east-1.on.aws/health)  
  *(Returns `HTTP 200 OK` `{"status":"ok","database":"ok","version":"1.0.0"}`)*

---

## 2. GitHub Repository & Key Commits

* **Student Repository:**  
  [https://github.com/shkundapn/SuccessfulSuccess_shkunda](https://github.com/shkundapn/SuccessfulSuccess_shkunda)

* **Commit Adding Cognito (Infrastructure + Frontend & Backend Auth):**  
  [`557c76efaa810a1fb5a89aa54158bc7239816c98`](https://github.com/shkundapn/SuccessfulSuccess_shkunda/commit/557c76efaa810a1fb5a89aa54158bc7239816c98)  
  *Changes:* Adds `infra/auth.yml`, `frontend/components/auth-page.tsx`, `frontend/lib/auth.ts`, `frontend/components/user-menu.tsx`, and backend JWT token verification (`backend/app/auth.py`).

* **Supporting Commits:**
  - [`ecd0592`](https://github.com/shkundapn/SuccessfulSuccess_shkunda/commit/ecd05924184a02094113bb7cec873e2429d713ac) — Pre-Sign-Up Lambda trigger auto-confirming users on signup (bypasses university email firewall delays).
  - [`3c95237`](https://github.com/shkundapn/SuccessfulSuccess_shkunda/commit/3c95237894a4c6a9a08404a80ce05f5ceb0f0254) — Dedicated `/login/` route for direct access.
  - [`a529441`](https://github.com/shkundapn/SuccessfulSuccess_shkunda/commit/a5294418659124451921f92e592737a4e52541a7) — Site header updated to explicitly display user email alongside avatar.

---

## 3. Image Verification & Submission Proofs

All screenshots have been verified and placed in this directory:

### Proof 1: User Signed In via Email & Password (Email Visible in Header)
* **File:** [`02_password_signin_header.png`](02_password_signin_header.png)
* **Verification Status:**  **Verified Correct**
* **Details:** Shows user signed in via Cognito credentials at `https://successfulsuccess.pp.ua/today/`. The authenticated email (`shkunda.pn@ucu.edu.ua`) is clearly visible in the top header bar next to the avatar, along with scheduled meetings.

### Proof 2: User Signed In via Google (Email Visible in Header)
* **File:** [`04_google_signin_header.png`](04_google_signin_header.png)
* **Verification Status:**  **Verified Correct**
* **Details:** Shows user signed in via Google OAuth at `https://successfulsuccess.pp.ua/today/`. The Google account email (`maksymshkunda123@gmail.com`) is prominently visible in the top header bar next to the avatar.

### Proof 3: Login Page with Both Auth Options
* **File:** [`01_login_page.png`](01_login_page.png)
* **Verification Status:**  **Verified Correct**
* **Details:** Shows `https://successfulsuccess.pp.ua/login/` containing the **"Continue with Google"** button, Email & Password input fields, **"Log in"** button, and the **"Sign up"** toggle for new account registration.

### Proof 4: Google OAuth Consent Screen
* **File:** [`03_google_oauth_prompt.png`](03_google_oauth_prompt.png)
* **Verification Status:**  **Verified Correct**
* **Details:** Demonstrates the Google identity selection screen authenticating into the Cognito domain (`spry-shkunda-783216615378.auth.us-east-1.amazoncognito.com`).

### Proof 5: Daily Meetings List
* **File:** [`05_meetings_list.png`](05_meetings_list.png)
* **Verification Status:**  **Verified Correct**
* **Details:** Shows full schedule of today's meetings with time pills, rooms, descriptions, and participant chips.

---

## 4. Operational & Infrastructure Status

* **Self Sign-Up:**  
  Enabled permanently on Cognito User Pool `us-east-1_dLIUUyTHp` (`AllowAdminCreateUserOnly: false`).
* **Pre-Sign-Up Auto-Confirm Trigger:**  
  Lambda `spry-shkunda-auto-confirm` automatically sets `autoConfirmUser = True` and `autoVerifyEmail = True` upon registration, ensuring that instructors can immediately register and test without waiting for email verification codes.
* **Google OAuth App:**  
  Configured with redirect URL `https://spry-shkunda-783216615378.auth.us-east-1.amazoncognito.com/oauth2/idpresponse` and enabled for production/external access.
* **Database & Migrations:**  
  Amazon RDS PostgreSQL 17 (`spry-shkunda-db`) fully migrated to Alembic head revision.
