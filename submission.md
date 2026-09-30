### Lab Submission: Authentication with AWS Cognito & Deployment

**Student:** Petro Shkunda (`shkunda.pn@ucu.edu.ua`)  
**Repository:** https://github.com/shkundapn/SuccessfulSuccess_shkunda  

---

#### 1. Endpoints & URLs (HTTPS on Custom Domain)
* **Login URL:** https://successfulsuccess.pp.ua/login/
  *(Supports Email/Password sign-up & sign-in and Continue with Google)*
* **Frontend Site (Custom Domain):** https://successfulsuccess.pp.ua
* **Direct CloudFront Fallback:** https://d1lbnhcst4jnzp.cloudfront.net
* **Backend API Base URL:** https://omp54u5dee63qjrnyqz74wo42y0brxmp.lambda-url.us-east-1.on.aws
* **Interactive Swagger UI:** https://omp54u5dee63qjrnyqz74wo42y0brxmp.lambda-url.us-east-1.on.aws/docs
* **API Health Check:** https://omp54u5dee63qjrnyqz74wo42y0brxmp.lambda-url.us-east-1.on.aws/health

---

#### 2. Key Git Commits
* **Commit Adding Cognito (Infrastructure + Frontend & Backend Auth):**  
  https://github.com/shkundapn/SuccessfulSuccess_shkunda/commit/557c76efaa810a1fb5a89aa54158bc7239816c98
* **Pre-Sign-Up Auto-Confirm Trigger:**  
  https://github.com/shkundapn/SuccessfulSuccess_shkunda/commit/ecd05924184a02094113bb7cec873e2429d713ac
* **Header Email Visibility Update:**  
  https://github.com/shkundapn/SuccessfulSuccess_shkunda/commit/a5294418659124451921f92e592737a4e52541a7

---

#### 3. Verified Submission Screenshots (Available in `submission/` directory)
1. `submission/01_login_page.png` — Login page showing Email/Password and Continue with Google options.
2. `submission/02_password_signin_header.png` — Site with user signed in via Password (email `shkunda.pn@ucu.edu.ua` visible in header).
3. `submission/03_google_oauth_prompt.png` — Google OAuth consent screen targeting the Cognito domain.
4. `submission/04_google_signin_header.png` — Site with user signed in via Google (email `maksymshkunda123@gmail.com` visible in header).
5. `submission/05_meetings_list.png` — Running frontend showing list of today's meetings.