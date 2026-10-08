# Lab 5: Weekly Meetings Report — Event-Driven Architecture on AWS

**Student:** Maksym Shkunda  
**Email:** `maksym.shkunda.25@cnu.edu.ua`  
**Repository:** [https://github.com/shkundapn/SuccessfulSuccess_shkunda](https://github.com/shkundapn/SuccessfulSuccess_shkunda)  

---

## 1. Commit Link

- **Commit adding reports feature, infra template, and Lambda handlers:**  
  [`1e7312f`](https://github.com/shkundapn/SuccessfulSuccess_shkunda/commit/1e7312f)  
  *Direct Link:* `https://github.com/shkundapn/SuccessfulSuccess_shkunda/commit/1e7312f`

- **Connection isolation refinement (`NullPool`):**  
  [`f655ff1`](https://github.com/shkundapn/SuccessfulSuccess_shkunda/commit/f655ff1)  
  *Direct Link:* `https://github.com/shkundapn/SuccessfulSuccess_shkunda/commit/f655ff1`

---

## 2. Screenshot of SES Delivered Email

- **Recipient:** `maksym.shkunda.25@cnu.edu.ua`
- **Sender:** `maksym.shkunda.25@cnu.edu.ua` (verified Amazon SES identity)
- **Subject:** `Weekly Meetings Report — 2026-W39` / `Weekly Meetings Report — 2026-W40`
- **Attachment:** `2026-W39.csv` / `2026-W40.csv`
- **SES Message ID:** `010001a11bbe150f-34616b28-2f27-476b-b8d5-474880631602-000000`

*(Attach screenshot of your university inbox showing the email and the CSV attachment).*

---

## 3. S3 Bucket Reports Listing

Output of command:
```bash
aws s3 ls s3://spry-shkunda-reports-783216615378/reports/ --recursive
```

```text
2026-10-08 16:40:04       1060 reports/2026-W39.csv
2026-10-08 16:41:01       1663 reports/2026-W40.csv
```

- `reports/2026-W39.csv`: Generated on demand via SQS message (`make report-now WEEK=2026-W39`).
- `reports/2026-W40.csv`: Generated via schedule trigger (`trigger=schedule`).

---

## 4. Three CloudWatch Log Lines (One per Trigger)

### 1. Schedule Trigger (`report-builder`):
```text
[INFO] 2026-10-08T13:41:00.066Z cdea9c67-9ca3-5a35-930a-ff26033c90ac report-builder triggered: trigger=schedule week=2026-W40
```

### 2. SQS Message Trigger (`report-builder`):
```text
[INFO] 2026-10-08T13:40:02.367Z e063f50e-35c3-54e7-93f0-964faaaa86b9 report-builder triggered: trigger=sqs week=2026-W39
```

### 3. S3 ObjectCreated Upload Trigger (`report-mailer`):
```text
[INFO] 2026-10-08T13:40:04.170Z 746f9176-6429-4dbd-a1b8-a89e7a4675e3 report-mailer triggered: trigger=s3 key=reports/2026-W39.csv
```

---

## 5. Written Answers to Part 3, Step 7 Questions

### Question 1:
> **The mailer got the same `ObjectCreated` event twice, and the person got two identical emails. Where would you store "this report was already sent", and what would the key be?**

**Answer:**
We would store the deduplication state in **Amazon DynamoDB** (or in a dedicated lightweight database table / S3 object metadata tagging) using an atomic conditional write (`attribute_not_exists(pk)`).
- **Key:** `report#<week>#<recipient_email>` (e.g., `report#2026-W40#maksym.shkunda.25@cnu.edu.ua`), or using the unique S3 object ETag: `s3_etag#<ETag>`.
- **Mechanism:** Before transmitting the email, the `report-mailer` Lambda executes `PutItem` with condition `attribute_not_exists(pk)`. If the key already exists (ConditionalCheckFailedException), the Lambda recognizes that the email has already been dispatched for this version of the report and terminates early without sending a duplicate.

---

### Question 2:
> **The builder in the VPC could not reach SES. List three ways to fix that, with their monthly cost: a NAT gateway, a VPC interface endpoint for SES, and the split you built. Which would you choose with ten more emails a week? With a million?**

**Answer:**

1. **NAT Gateway:**
   - **Cost:** ~$32.40/month per AZ ($0.045/hour) + $0.045/GB data processing charges.
   - Provides full outbound internet connectivity for all resources in private subnets.
2. **VPC Interface Endpoint (AWS PrivateLink for SES):**
   - **Cost:** ~$7.20/month per AZ ($0.01/hour) + $0.01/GB data processing charges.
   - Provides private, dedicated connectivity to Amazon SES within the VPC without routing to the public internet.
3. **The Split Architecture (Builder in VPC -> S3 Gateway Endpoint -> Mailer outside VPC):**
   - **Cost:** **$0.00/month** fixed baseline cost. The S3 Gateway VPC Endpoint is free; Lambda invocations and S3 storage fall well within standard AWS free tier limits / fractions of a cent.

**Decision / Recommendations:**
- **With 10 more emails a week:** Choose the **split architecture** ($0.00 cost vs paying $32+/month for a NAT Gateway or $7+/month for PrivateLink). Paying hourly endpoint fees for 10 weekly messages would be financially wasteful.
- **With 1 million emails a week:**
  - If a direct, single-function design is preferred, the **VPC Interface Endpoint for SES** (~$7.20/month) is significantly cheaper than a NAT Gateway.
  - However, the **split event-driven architecture remains superior even at 1 million emails** because:
    1. It decouples long-running database aggregations from external SMTP/SES network calls.
    2. S3 acts as a durable artifact cache (reports can be redownloaded or re-sent without re-querying the database).
    3. SQS provides automatic backpressure and rate buffering against SES sending quotas without incurring hourly endpoint charges.

---

### Question 3:
> **You could send a presigned S3 link instead of an attachment. A presigned URL signed with a Lambda role's temporary credentials stops working when those credentials expire, often within hours. How would you send a link that works for a week?**

**Answer:**
There are two production solutions:
1. **Amazon CloudFront Signed URLs with Origin Access Control (OAC):** Place CloudFront in front of the S3 reports bucket. Generate signed URLs using a private RSA key pair associated with a CloudFront Public Key / Key Group. CloudFront signed URLs are independent of AWS STS temporary session tokens and can be signed with any expiration time up to years (including exactly 7 days).
2. **Dedicated IAM User Credentials:** Generate the presigned S3 URL using long-lived AWS IAM user credentials (stored securely in AWS Secrets Manager or SSM Parameter Store) instead of the Lambda execution role's STS temporary credentials. Under AWS SigV4, presigned URLs signed with long-lived IAM user credentials can remain valid for up to the maximum allowable duration of 7 days (604,800 seconds).

---

## 6. Architecture & Deliverables Summary

| Primitives | Service Used | Configuration |
| :--- | :--- | :--- |
| **Schedule** | Amazon EventBridge Scheduler | `cron(0 7 ? * MON *)` in timezone `Europe/Kyiv` |
| **Command Queue** | Amazon SQS | Queue `spry-shkunda-report-requests` + DLQ `...-dlq` (`maxReceiveCount: 3`) |
| **Data Processing** | AWS Lambda (`report-builder`) | In VPC, queries PostgreSQL, isolated `NullPool` |
| **VPC S3 Connectivity** | AWS VPC Gateway Endpoint | `com.amazonaws.us-east-1.s3` attached to route tables |
| **Result Store** | Amazon S3 | Bucket `spry-shkunda-reports-783216615378` (90-day lifecycle) |
| **Event Routing** | S3 Event Notifications | `s3:ObjectCreated:*` on prefix `reports/`, suffix `.csv` |
| **Email Delivery** | AWS Lambda (`report-mailer`) + SES | Outside VPC, reads S3 and sends multipart MIME email via Amazon SES |
