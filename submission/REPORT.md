# Lab Submission: Authentication with AWS Cognito & Federated Google Login

**Student:** Maksym Shkunda (`shkunda.pn@ucu.edu.ua`)  
**Repository:** [https://github.com/shkundapn/SuccessfulSuccess_shkunda](https://github.com/shkundapn/SuccessfulSuccess_shkunda)  
**Date:** September 30, 2026  

---

## 1. Login Page URL (HTTPS on Custom Domain)

* **Dedicated Login URL:**  
  [https://successfulsuccess.pp.ua/login/](https://successfulsuccess.pp.ua/login/)  
  *(Also accessible via root: [https://successfulsuccess.pp.ua](https://successfulsuccess.pp.ua))*

### Verification of Authentication Features:
1. **Email & Password Authentication:**
   - Supports **Sign-in** with registered email & password.
   - Supports **Self-Registration (Sign-up)** directly from the UI (`AllowAdminCreateUserOnly: false`).
   - Automatically confirms accounts via Pre-Sign-Up trigger (`spry-shkunda-auto-confirm`) so new users don't face firewall code delivery delays.
2. **Federated Google Sign-In:**
   - Prominently displays the **"Continue with Google"** button.
   - Authenticates through the Cognito Hosted Domain (`spry-shkunda-783216615378.auth.us-east-1.amazoncognito.com`).
   - Google OAuth client is configured for production access, allowing external UCU and personal Google accounts to sign in.
3. **Post-Sign-In Redirection & Header State:**
   - Both flows redirect back to `https://successfulsuccess.pp.ua/today/`.
   - The user profile is synced to the database via `POST /api/v1/me/sync`.
   - The authenticated user's **email is explicitly visible in the top header bar** next to the user avatar.

---

## 2. Screenshots (User Signed In with Email Visible in Header)

> *Note on Uploads:* To stay within the submission platform's 5-file limit without archiving, the full sign-in flows (entry screen + authenticated site) are provided as single composite images:

### Screenshot 1: Signed In with Email & Password
* **Primary Submission File:** [`01_password_signin_flow.png`](01_password_signin_flow.png)  
  *(Individual component files: [`02_password_signin_header.png`](02_password_signin_header.png) & [`01_login_page.png`](01_login_page.png))*
* **Content:**
  - **Top:** The login page with email (`shkunda.pn@ucu.edu.ua`) and password filled in, displaying the "Continue with Google" option and Sign-up link.
  - **Bottom:** The authenticated `/today/` page with user's email (`shkunda.pn@ucu.edu.ua`) **clearly visible in the top header bar** next to the avatar.

### Screenshot 2: Signed In with Google
* **Primary Submission File:** [`02_google_signin_flow.png`](02_google_signin_flow.png)  
  *(Individual component files: [`04_google_signin_header.png`](04_google_signin_header.png) & [`03_google_oauth_prompt.png`](03_google_oauth_prompt.png))*
* **Content:**
  - **Top:** The Google account selection screen redirecting to Cognito (`spry-shkunda-783216615378.auth.us-east-1.amazoncognito.com`).
  - **Bottom:** The authenticated `/today/` page with the Google account email (`maksymshkunda123@gmail.com`) **clearly visible in the top header bar** next to the avatar.

### Bonus / Supporting Screenshot: Running Frontend & Meetings
* **File:** [`03_meetings_list.png`](03_meetings_list.png)
* **Content:** Shows the running meeting management dashboard with scheduled items.

---

## 3. Git Commit Adding Cognito

* **Commit Link:**  
  [`https://github.com/shkundapn/SuccessfulSuccess_shkunda/commit/557c76efaa810a1fb5a89aa54158bc7239816c98`](https://github.com/shkundapn/SuccessfulSuccess_shkunda/commit/557c76efaa810a1fb5a89aa54158bc7239816c98)

### Key Files in this Commit:
* **Infrastructure Template:** [`infra/auth.yml`](https://github.com/shkundapn/SuccessfulSuccess_shkunda/blob/557c76efaa810a1fb5a89aa54158bc7239816c98/infra/auth.yml) (Cognito UserPool, Domain, UserPoolClient, GoogleIdentityProvider).
* **Frontend Authentication:** [`frontend/components/auth-page.tsx`](https://github.com/shkundapn/SuccessfulSuccess_shkunda/blob/557c76efaa810a1fb5a89aa54158bc7239816c98/frontend/components/auth-page.tsx), [`frontend/lib/auth.ts`](https://github.com/shkundapn/SuccessfulSuccess_shkunda/blob/557c76efaa810a1fb5a89aa54158bc7239816c98/frontend/lib/auth.ts), [`frontend/components/user-menu.tsx`](https://github.com/shkundapn/SuccessfulSuccess_shkunda/blob/557c76efaa810a1fb5a89aa54158bc7239816c98/frontend/components/user-menu.tsx).
* **Backend Verification:** [`backend/app/auth.py`](https://github.com/shkundapn/SuccessfulSuccess_shkunda/blob/557c76efaa810a1fb5a89aa54158bc7239816c98/backend/app/auth.py) (JWT token decode and signature verification).

### Additional Supporting Commits:
* [`ecd0592`](https://github.com/shkundapn/SuccessfulSuccess_shkunda/commit/ecd05924184a02094113bb7cec873e2429d713ac) — Pre-Sign-Up Auto-Confirm Lambda trigger.
* [`a529441`](https://github.com/shkundapn/SuccessfulSuccess_shkunda/commit/a5294418659124451921f92e592737a4e52541a7) — Header update displaying user email next to avatar.

---

## 4. Deployed Service Endpoints Reference

* **Frontend Custom Domain:** `https://successfulsuccess.pp.ua`
* **CloudFront CDN Fallback:** `https://d1lbnhcst4jnzp.cloudfront.net`
* **Backend Lambda Function URL:** `https://omp54u5dee63qjrnyqz74wo42y0brxmp.lambda-url.us-east-1.on.aws`
* **Interactive Swagger UI:** `https://omp54u5dee63qjrnyqz74wo42y0brxmp.lambda-url.us-east-1.on.aws/docs`
* **API Health Check:** `https://omp54u5dee63qjrnyqz74wo42y0brxmp.lambda-url.us-east-1.on.aws/health`
