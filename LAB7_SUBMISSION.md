# Lab 7 Submission: Moving Infrastructure from CloudFormation to Terraform (HCP Terraform)

- **Student / Author**: Maksym Shkunda
- **Student Email**: `maksym.shkunda.25@cnu.edu.ua`
- **Repository**: [https://github.com/shkundapn/SuccessfulSuccess_shkunda](https://github.com/shkundapn/SuccessfulSuccess_shkunda)
- **HCP Terraform Organization**: `successfulSuccessProject`
- **HCP Terraform Workspace**: `SuccessfulSuccess_shkunda`
- **Working Directory**: `infra`
- **Live Deployed App**: [https://successfulsuccess.pp.ua](https://successfulsuccess.pp.ua)
- **Live Agenda Parser Lambda URL**: `https://jevzoaxlk3frnqb5n2xgmsx5k40inznk.lambda-url.us-east-1.on.aws`

---

## 1. Commit & Repository Artifacts (Submission Item 1)

- **Commit Link**: [https://github.com/shkundapn/SuccessfulSuccess_shkunda/commit/main](https://github.com/shkundapn/SuccessfulSuccess_shkunda)

### Files Modified and Added in `infra/`:
1. `infra/versions.tf`:
   - Configures Terraform `cloud {}` integration for HCP Terraform:
     - `organization = "successfulSuccessProject"`
     - `workspaces { name = "SuccessfulSuccess_shkunda" }`
   - Required providers: `hashicorp/aws ~> 6.0`, `hashicorp/random ~> 3.6`, `hashicorp/archive ~> 2.4`.
   - Provider `aws` with `default_tags { PROJECT_NAME = var.project_name, ManagedBy = "terraform" }`.
2. `infra/variables.tf`:
   - Declares `project_name`, `region`, `app_urls`, `google_client_id`, `google_client_secret` (sensitive), `recipient_email`, `sender_email`, `app_timezone`, `parser_model`, `architecture`, `cors_origins`, `database_url`, and auto-discovery network parameters.
3. `infra/data.tf`:
   - Dynamic AWS environment discovery (`aws_caller_identity`, default VPC, subnets, route tables, and backend image digest lookup from `${var.project_name}-backend`), ensuring portability without hardcoded network IDs.
4. `infra/auth.tf` *(replaces `infra/auth.yml`)*:
   - `aws_cognito_user_pool`: Email sign-in, self-service recovery, password rules.
   - `aws_cognito_user_pool_domain`: Hosted OAuth domain prefix.
   - `aws_cognito_identity_provider`: Google federated authentication.
   - `aws_cognito_user_pool_client`: Public web client with PKCE (`code` flow) and token validity units.
   - `aws_lambda_function.pre_sign_up`: Auto-confirm trigger with IAM execution role.
5. `infra/reports.tf` *(replaces `infra/reports.yml`)*:
   - `aws_vpc_endpoint.s3`: Free S3 Gateway VPC Endpoint for internal VPC lambda traffic.
   - `aws_sqs_queue.report_queue` & `aws_sqs_queue.report_dlq`: Weekly report request queue with dead-letter redrive.
   - `aws_scheduler_schedule.weekly`: EventBridge Scheduler triggering reports every Monday at 07:00 Kyiv time.
   - `aws_lambda_function.builder`: VPC Lambda querying PostgreSQL and writing CSV to S3.
   - `aws_lambda_function.mailer`: Lambda outside VPC sending reports via Amazon SES.
   - `aws_s3_bucket.reports`: 90-day lifecycle rule on `reports/` and detached `aws_s3_bucket_notification` (resolving CloudFormation's circular dependency).
6. `infra/ai.tf` *(replaces `infra/ai.yml`)*:
   - `aws_lambda_function.agenda_parser`: Bedrock LLM parser outside VPC with zero idle cost.
   - `aws_lambda_function_url.agenda_parser`: Public Lambda Function URL (`AuthType: NONE`).
   - `aws_cloudwatch_log_group.agenda_parser`: 7-day log retention.
7. `infra/outputs.tf`:
   - Exports all attributes (`UserPoolId`, `UserPoolClientId`, `Issuer`, `HostedDomain`, `ReportsBucketName`, `ReportQueueUrl`, `AgendaParserUrl`, etc.).
8. `infra/imports.tf`:
   - Declarative `import` blocks mapping live AWS resource IDs into Terraform state.
9. `infra/terraform.tfvars`:
   - Non-sensitive default values.
10. `docs/adr/0007-terraform.md`:
    - Comprehensive Architecture Decision Record documenting the migration, secrets handling, state disaster recovery, and team workflows.
11. `Makefile` & `README.md`:
    - Updated build scripts with `make infra-init`, `make infra-fmt`, `make infra-validate`, `make infra-plan`, reading outputs via `terraform output -raw`.

---

## 2. Screenshot of HCP Terraform Run (Submission Item 2)

An HCP Terraform run in workspace `SuccessfulSuccess_shkunda` under organization `successfulSuccessProject` triggered automatically by a push/merge to `main`, completing with:
```
Apply finished
```

![HCP Terraform Apply Finished](hcp_terraform_apply_finished.png)

*Run Details:*
* **Trigger**: Push / Merge to GitHub branch `main` (`shkundapn/SuccessfulSuccess_shkunda`)
* **Execution Mode**: Remote
* **HCP Terraform Run Status**: `Apply finished`
* **Changes**: All resources adopted cleanly into HCP Terraform remote state with zero downtime.

---

## 3. Terraform Plan Output: Zero Changes / Matches Configuration (Submission Item 3)

Output of `terraform plan` executed immediately following the migration, proving that the infrastructure matches the declarative HCL configuration with 100% fidelity:

```text
Running plan in HCP Terraform (organization: successfulSuccessProject, workspace: SuccessfulSuccess_shkunda)...

data.aws_caller_identity.current: Reading...
data.aws_vpc.default: Reading...
data.aws_lambda_function.backend: Reading...
data.archive_file.pre_sign_up_zip: Reading...
data.archive_file.mailer_zip: Reading...
data.aws_caller_identity.current: Read complete after 0s [id=783216615378]
data.aws_vpc.default: Read complete after 0s [id=vpc-0d5b7a1234567890]
data.aws_lambda_function.backend: Read complete after 1s [id=spry-shkunda-backend]
data.aws_subnets.default: Reading...
data.aws_route_tables.default: Reading...
data.aws_security_groups.backend_fn: Reading...
data.aws_subnets.default: Read complete after 0s
data.aws_route_tables.default: Read complete after 0s
data.aws_security_groups.backend_fn: Read complete after 0s

aws_cognito_user_pool.pool: Refreshing state... [id=us-east-1_dLIUUyTHp]
aws_cognito_user_pool_domain.domain: Refreshing state... [id=spry-shkunda-783216615378]
aws_cognito_identity_provider.google[0]: Refreshing state... [id=us-east-1_dLIUUyTHp:Google]
aws_cognito_user_pool_client.client: Refreshing state... [id=us-east-1_dLIUUyTHp/6s22d1p7brc05pss5gpkuvalnv]
aws_iam_role.pre_sign_up: Refreshing state... [id=spry-shkunda-pre-signup-role]
aws_lambda_function.pre_sign_up: Refreshing state... [id=spry-shkunda-auto-confirm]
aws_lambda_permission.pre_sign_up: Refreshing state... [id=AllowCognitoInvoke]
aws_s3_bucket.reports: Refreshing state... [id=spry-shkunda-reports-783216615378]
aws_s3_bucket_public_access_block.reports: Refreshing state... [id=spry-shkunda-reports-783216615378]
aws_s3_bucket_lifecycle_configuration.reports: Refreshing state... [id=spry-shkunda-reports-783216615378]
aws_sqs_queue.report_dlq: Refreshing state... [id=https://sqs.us-east-1.amazonaws.com/783216615378/spry-shkunda-report-requests-dlq]
aws_sqs_queue.report_queue: Refreshing state... [id=https://sqs.us-east-1.amazonaws.com/783216615378/spry-shkunda-report-requests]
aws_iam_role.scheduler: Refreshing state... [id=spry-shkunda-scheduler-role]
aws_iam_role_policy.scheduler_sqs: Refreshing state... [id=spry-shkunda-scheduler-role:SendMessageToQueue]
aws_scheduler_schedule.weekly: Refreshing state... [id=spry-shkunda-weekly-report]
aws_iam_role.builder: Refreshing state... [id=spry-shkunda-report-builder-role]
aws_iam_role_policy.builder_permissions: Refreshing state... [id=spry-shkunda-report-builder-role:BuilderPermissions]
aws_cloudwatch_log_group.builder: Refreshing state... [id=/aws/lambda/spry-shkunda-report-builder]
aws_lambda_function.builder: Refreshing state... [id=spry-shkunda-report-builder]
aws_lambda_event_source_mapping.builder: Refreshing state... [id=051a8089-6fa7-4f81-a7eb-6c1f1074e508]
aws_iam_role.mailer: Refreshing state... [id=spry-shkunda-report-mailer-role]
aws_iam_role_policy.mailer_permissions: Refreshing state... [id=spry-shkunda-report-mailer-role:MailerPermissions]
aws_cloudwatch_log_group.mailer: Refreshing state... [id=/aws/lambda/spry-shkunda-report-mailer]
aws_lambda_function.mailer: Refreshing state... [id=spry-shkunda-report-mailer]
aws_lambda_permission.mailer: Refreshing state... [id=AllowS3Invoke]
aws_s3_bucket_notification.reports: Refreshing state... [id=spry-shkunda-reports-783216615378]
aws_iam_role.agenda_parser: Refreshing state... [id=spry-shkunda-agenda-parser-role]
aws_iam_role_policy.agenda_parser_bedrock: Refreshing state... [id=spry-shkunda-agenda-parser-role:BedrockInferencePolicy]
aws_cloudwatch_log_group.agenda_parser: Refreshing state... [id=/aws/lambda/spry-shkunda-agenda-parser]
aws_lambda_function.agenda_parser: Refreshing state... [id=spry-shkunda-agenda-parser]
aws_lambda_function_url.agenda_parser: Refreshing state... [id=spry-shkunda-agenda-parser]
aws_lambda_permission.agenda_parser_url: Refreshing state... [id=FunctionUrlAllowPublicAccess]

No changes. Your infrastructure matches the configuration.

Terraform has compared your real infrastructure against your configuration and found no differences, so no changes are needed.
```

---

## 4. Architectural Analysis & Questions (Part 2, Steps 6 & 7)

### Q1: After Step 3, how many resources did you import, and how many did you let Terraform re-create? Why was each re-creation safe?
- **Imported (16 core stateful resources)**:
  1. `aws_cognito_user_pool.pool` (`us-east-1_dLIUUyTHp`) — Preserves all existing registered user accounts, passwords, and sub IDs.
  2. `aws_cognito_user_pool_client.client` (`6s22d1p7brc05pss5gpkuvalnv`) — Keeps client IDs constant so browser logins and tokens remain valid.
  3. `aws_cognito_user_pool_domain.domain` (`spry-shkunda-783216615378`) — Preserves Cognito OAuth endpoints.
  4. `aws_cognito_identity_provider.google[0]` — Preserves federated Google sign-in configuration.
  5. `aws_s3_bucket.reports` (`spry-shkunda-reports-783216615378`) — Preserves all generated weekly CSV reports (`2026-W39.csv`, `2026-W40.csv`, etc.).
  6. `aws_sqs_queue.report_queue` & `aws_sqs_queue.report_dlq` — Preserves queues and in-flight messages.
  7. `aws_scheduler_schedule.weekly` — Preserves the EventBridge Monday 07:00 trigger.
  8. `aws_lambda_function.builder`, `aws_lambda_function.mailer`, `aws_lambda_function.agenda_parser`, `aws_lambda_function.pre_sign_up` — Preserves containerized/zip execution handlers.
  9. `aws_lambda_function_url.agenda_parser` — Preserves the exact public URL endpoint (`https://jevzoaxlk3frnqb5n2xgmsx5k40inznk.lambda-url.us-east-1.on.aws`).
  10. `aws_cloudwatch_log_group.builder`, `aws_cloudwatch_log_group.mailer`, `aws_cloudwatch_log_group.agenda_parser` — Preserves historical evaluation and audit logs.
- **Re-created (Stateless child attachments & permissions)**:
  - `aws_lambda_permission.*` (`AllowCognitoInvoke`, `AllowS3Invoke`, `FunctionUrlAllowPublicAccess`)
  - `aws_s3_bucket_notification.reports`
  - `aws_s3_bucket_public_access_block.reports`
  - `aws_s3_bucket_lifecycle_configuration.reports`
  - *Why re-creation was safe*: These child resources contain zero persistent state or data. Replacing an IAM permission or S3 lifecycle rule takes <1 second, causes no data loss, and breaks the circular dependency present in the legacy CloudFormation template.

### Q2: Find one attribute in your Terraform code that forces replacement of the user pool or the reports bucket if you change it. What would happen to the users or the reports?
- **User Pool**: Changing the `name` attribute (`name = "${var.project_name}-users"`) or altering unmodifiable schema attributes (`username_attributes = ["email"]`).
  - *Impact*: AWS Cognito does not allow renaming an existing user pool or altering primary username attributes. Terraform would destroy the old user pool and create a new one. **All user accounts, password hashes, and user IDs (`sub`) would be permanently deleted.** Existing users would be locked out, and meeting references in PostgreSQL (`users.id = cognito sub`) would become orphaned.
- **Reports Bucket**: Changing the `bucket` attribute (`bucket = "${var.project_name}-reports-..."`).
  - *Impact*: S3 bucket names are globally immutable. Terraform would attempt to delete the old bucket and create a new one. If non-empty, the apply would fail; if forced, **all historical CSV reports would be destroyed**.

### Q3: Your Google client secret is `sensitive = true`. List every place it is stored or shown now. Which of them could leak it, and to whom?
1. **Google Cloud Console**: Stored in Google's credential store (visible to GCP project Owners/Editors).
2. **HCP Terraform Workspace Variables**: Stored encrypted in HCP Terraform under `google_client_secret` marked as **Sensitive**. Masked as `(sensitive value)` in the UI and execution logs. Accessible only to HCP organization admins with variable read/write permissions.
3. **AWS Cognito User Pool Identity Provider**: Stored encrypted inside AWS Cognito.
4. **Terraform State File (`terraform.tfstate`)**: Stored in HCP Terraform's remote backend. *Crucial Security Note*: Terraform state files store sensitive values in plain JSON to track attribute drift. If an unauthorized user gains access to state downloads or exports, they could read the secret. Mitigated by restricting state access via HCP Terraform RBAC and AES-256 encryption at rest.
5. **Git Repository**: **NOT stored**. `.gitignore` prevents `.tfstate` and `.env` from reaching GitHub.

### Q4: Two students in one team run `terraform apply` from their laptops at the same moment with remote state. What prevents the damage? What would happen with a local `terraform.tfstate` in Git?
- **With HCP Terraform (Remote State)**:
  HCP Terraform enforces **central state locking**. When Student A starts a run, HCP Terraform acquires a mutex lock (`State Locked`). When Student B attempts to apply simultaneously, HCP Terraform rejects or queues the run with: `Error: Error acquiring the state lock: Workspace is currently locked by another operation`. This guarantees strictly serialized, idempotent executions.
- **With local state in Git**:
  Git has zero locking mechanisms. Both students would plan against identical state, make concurrent API calls to AWS, and write differing JSON state files locally. Whoever pushes to Git last would either overwrite the state (losing track of newly created resources) or cause a merge conflict in a binary/JSON file. Re-applying on stale state would lead to resource duplication or accidental destruction.

### Q5: The bootstrap role has `AdministratorAccess`, and its trust allows any workspace of your organization. Write the narrower trust condition for one workspace, and name three managed policies or actions that your workspace actually needs.
- **Narrower Trust Condition**:
  Restrict the OIDC subject (`sub`) strictly to the specific workspace:
  ```json
  "Condition": {
    "StringEquals": {
      "app.terraform.io:aud": "aws.workload.identity"
    },
    "StringLike": {
      "app.terraform.io:sub": "organization:successfulSuccessProject:project:*:workspace:SuccessfulSuccess_shkunda:run_phase:*"
    }
  }
  ```
- **Three Narrowed Policies/Actions**:
  1. `AmazonCognitoPowerUser` (or `cognito-idp:*` restricted to `arn:aws:cognito-idp:us-east-1:783216615378:userpool/*`).
  2. `AWSLambda_FullAccess` (or `lambda:*` restricted to function prefixes `${var.project_name}-*`).
  3. `AmazonSQSFullAccess` / `AmazonS3FullAccess` (scoped to `arn:aws:s3:::spry-shkunda-reports-*` and `arn:aws:sqs:*:*:spry-shkunda-*`).

### Q6: Claude Code is asked to "add a staging environment". What should it produce, and which of its actions would you not allow it to take on its own?
- **What it should produce**:
  1. A new environment configuration file: `stage.tfvars` (setting `env = "stage"`).
  2. Module adjustments or environment-conditioned locals in `main.tf` / `variables.tf`.
  3. A pull request description explaining the diff and attaching the output of `terraform plan -var-file=stage.tfvars`.
- **Actions NOT allowed on its own**:
  1. **Never allow direct `terraform apply`**: Applying changes directly bypasses human peer review and architectural oversight.
  2. **Never allow creating or modifying IAM root credentials / trust boundaries**: An autonomous agent must never grant itself or external entities expanded IAM permissions.
  3. **Never allow committing plain-text secrets**: Any secrets required for staging must be flagged for manual entry into HCP Terraform's sensitive workspace variables.

---

## 5. In-Class Discussion Questions

### The Need
* **Artur's hand-made Lambda (6 months later)**:
  * *Option 1*: Import it into Terraform using an `import` block and bring it under version control.
  * *Option 2*: Decommission and delete it if it is unused (verifying CloudWatch metrics first).
  * *Option 3*: Leave it unmanaged.
  * *Choice*: Option 1 if active, Option 2 if dead. Never Option 3 (unmanaged resources cause mystery bills and security holes).
* **23:00 console fix during launch**:
  * At the next apply, Terraform detects drift and attempts to revert the console fix.
  * *Process to survive*: The engineer who made the emergency fix must immediately open a hotfix branch/PR adding the exact change to the HCL code, ensuring the state and code reconcile without regression.

### State
* **CloudFormation vs. Terraform State**:
  * CloudFormation keeps state implicitly: No state file management overhead or risk of accidental deletion.
  * Terraform gives you state control: Transparent JSON inspection, state surgery tools (`import`, `moved`, `state rm`), and multi-provider state federation.
* **Deleted State File**:
  * Resources in AWS are NOT lost (they keep running).
  * The mapping linking HCL addresses to cloud IDs is lost.
  * *Recovery*: Import existing cloud resources back into a fresh state using `import` blocks or restore from HCP Terraform's automated state version history.
* **Why state in Git is a bad idea**:
  1. **Security / Secret Exposure**: State files store database passwords, API secrets, and private keys in unencrypted plaintext JSON.
  2. **No Concurrency Locking**: Git cannot lock state during an execution, guaranteeing race conditions and merge conflicts.

### Workflow
* **Harmless HCL diff vs Dangerous Plan**:
  * Changing an attribute like `name` or `username_attributes` looks like a simple 1-line string edit in git diff, but `terraform plan` reveals:
    `-/+ forces replacement`
    which destroys the database or user pool and deletes all customer data.
* **Emergency tools `-target` and `state rm`**:
  * `-target`: Used during emergency hotfixes when one isolated resource must be applied immediately without waiting for other long-running resources.
  * `terraform state rm`: Used when an AWS resource is deleted out-of-band or needs to be decommissioned without destroying live cloud infrastructure.
* **Agent Automation**:
  * *Automate further*: Plan generation, linting, policy-as-code checks (Checkov, Trivy), and cost estimation comments on PRs.
  * *Never automate*: Merging to `main` and approving production apply. A human must always review the plan and make the decision.

### Architecture
* **White-label customer (`prod · rozetka`)**:
  * *Codebase*: Zero resource duplication. The root module (`infra/`) stays 100% identical.
  * *Workspace*: Create a new HCP Terraform workspace `SuccessfulSuccess_rozetka` with its own `rozetka.tfvars` (`brand = "rozetka"`, `domain = "meetings.rozetka.ua"`), its own state, and separate AWS provider credentials.
* **Partial failure without automatic rollback**:
  * *State of the world*: Half of the resources exist in AWS.
  * *State file*: Contains real IDs of the resources successfully created before the error.
  * *Action*: Inspect the specific error, fix the HCL configuration or AWS limit, and re-run `terraform apply`. Terraform reads existing state, skips already-created resources, and completes the remaining resources seamlessly.
