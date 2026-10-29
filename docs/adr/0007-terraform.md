# ADR 0007: Migrating Infrastructure from CloudFormation to Terraform with HCP Terraform

- **Status**: Accepted
- **Date**: 2026-10-29
- **Author**: SuccessfulSuccess Team (Lab 7)
- **Deciders**: Software Architect, DevOps Engineering, Security Lead

---

## 1. Context

In Labs 4, 5, and 6, Spry deployed its authentication (`infra/auth.yml`), weekly reporting pipeline (`infra/reports.yml`), and LLM agenda parser (`infra/ai.yml`) using AWS CloudFormation. While the stacks functioned, they suffered from significant organizational and architectural limitations:

1. **Multi-Cloud and External Ecosystem Boundaries**:
   Our application architecture relies on non-AWS external systems:
   - Google Cloud OAuth 2.0 Web Application credentials and redirect URIs.
   - GitHub Actions CI/CD workflows and repository secrets.
   - Public DNS custom domain management (`successfulsuccess.pp.ua`).
   CloudFormation is locked strictly to AWS services and cannot orchestrate resources across third-party providers in a single cohesive plan.

2. **State Transparency & Drift Management**:
   CloudFormation manages state implicitly inside AWS, concealing drift unless explicitly triggered. Discrepancies between local templates and the live cloud often resulted in unexpected stack rollback loops that took 20+ minutes to resolve.

3. **Multi-Environment Orchestration**:
   Scaling from a single developer laptop to team environments (Dev, Staging, Production, and white-label client deployments like `rozetka`) requires parameterizing the infrastructure without cloning YAML templates or hand-crafting shell scripts.

We require a modern Infrastructure as Code (IaC) tool that unifies multi-cloud provisioning, provides deterministic preview plans before execution, and centralizes state management with concurrency locking.

---

## 2. Decision

We replace the three CloudFormation templates (`auth.yml`, `reports.yml`, `ai.yml`) with declarative **Terraform HCL** in `infra/` managed centrally by **HCP Terraform (formerly Terraform Cloud)**:

- **HCP Organization**: `successfulSuccessProject`
- **HCP Workspace**: `SuccessfulSuccess_shkunda`
- **Terraform Working Directory**: `infra/`
- **Execution Mode**: Remote execution with dynamic AWS OIDC credentials.

Existing production resources (Cognito User Pool with signed-up users, S3 Reports Bucket with generated CSV files, SQS queues, and Lambda functions) are adopted into Terraform state without destruction or downtime using declarative `import` blocks.

---

## 3. Key Architectural Questions Answered

### Q1: Why Terraform and not CloudFormation, CDK, or OpenTofu for this project?

| Tool | Assessment for Spry | Reason It Won / Lost |
| :--- | :--- | :--- |
| **Terraform (Adopted)** | **Chosen**. Rich provider ecosystem (AWS, Google Cloud, GitHub, Cloudflare), declarative HCL with first-class type safety, deterministic `plan` output, central remote state locking, and seamless VCS integration in HCP Terraform. | **Winner**. Perfectly fits our multi-provider roadmap (AWS + Google OAuth + GitHub). |
| **AWS CloudFormation** | Cloud-native to AWS, but strictly single-cloud. Lacks native providers for Google Cloud or GitHub, relies on complex YAML intrinsic functions (`!Sub`, `!GetAtt`, `!If`), and does not provide an interactive pre-apply plan verification workflow. | **Lost**. Inability to manage non-AWS primitives and painful rollback behavior on failure. |
| **AWS CDK** | Generates CloudFormation templates using TypeScript/Python. While expressive, it adds an extra layer of abstraction and synthesis complexity without solving CloudFormation's underlying deployment limitations, single-cloud lock-in, or slow VPC Lambda interface cleanups. | **Lost**. Added compilation overhead without multi-cloud provider breadth. |
| **OpenTofu** | Open-source fork of Terraform with compatible syntax. Highly capable, but does not include a free turnkey SaaS collaboration platform equivalent to HCP Terraform for student/team remote state locking, speculative PR plans, and managed OIDC credentials without self-hosting runners and S3/DynamoDB backends. | **Lost**. HCP Terraform provides a zero-maintenance, zero-cost SaaS management plane for this project. |

### Q2: Who can change the infrastructure now, and how?

**Nobody applies infrastructure changes directly from a laptop.** Applying from a laptop with root credentials creates configuration drift, unreviewed changes, and knowledge silos.

The sanctioned deployment pipeline follows a strictly governed two-road process:
```
[ Developer / Claude Code ]
             │
             ▼
   [ Feature Branch Git Push ]
             │
             ▼
  [ GitHub Pull Request ] ──────► Triggers Speculative `terraform plan` in HCP Terraform
             │                    (Reviewers inspect plan: +to add, ~to change, -to destroy)
             ▼
      [ Merge to main ]
             │
             ▼
 [ HCP Terraform Remote Run ] ───► Exchanges OIDC token for short-lived AWS IAM Role credentials
                                  Executes `terraform apply` to remote state and AWS
```
- **Local machine**: Can run `make infra-plan` for speculative validation. Local apply is disabled.
- **HCP Terraform**: Runs plans on pull requests and automatically applies upon merge to `main`.
- **Auditability**: Every change has a Git commit author, an associated pull request review, and an immutable run log in HCP Terraform.

### Q3: Where do secrets end up, the state included?

1. **Git Repository Hygiene**:
   - Zero secrets are committed to Git.
   - `.gitignore` explicitly excludes `.env`, `*.tfstate`, `*.tfstate.*`, `*.tfplan`, and `crash.log`.
   - `infra/terraform.tfvars` contains only non-sensitive identifiers and region parameters.

2. **Sensitive Workspace Variables**:
   - `google_client_secret`, database connection strings, and AWS credentials reside exclusively within the HCP Terraform workspace as **Sensitive Variables**.
   - Sensitive values are masked in all HCP Terraform logs, CLI execution outputs, and PR checks with `(sensitive value)`.

3. **State File Protection**:
   - The Terraform state file contains mappings of cloud resources and may hold plain values of attributes.
   - State lives entirely within HCP Terraform, encrypted at rest using AES-256 (AWS KMS) and encrypted in transit via TLS 1.3. Access is governed by role-based access control (RBAC).

### Q4: What happens if HCP Terraform is down?

1. **Running Application Is Unaffected**:
   HCP Terraform operates strictly as a **control plane**. The runtime data plane (Cognito User Pool, Aurora PostgreSQL, Next.js CloudFront distribution, Lambda functions) runs entirely inside AWS and continues serving production traffic with zero dependency on HCP Terraform uptime.

2. **Emergency Break-Glass Procedure**:
   If an emergency hotfix is required during an HCP Terraform outage:
   - Authorized engineers with AWS admin credentials can temporarily switch the backend configuration in `versions.tf` from `cloud {}` to a secure emergency S3 backend or local state with state migration (`terraform init -migrate-state`).
   - Targeted updates can be applied using `terraform apply -target=<resource>`.
   - Once HCP Terraform service resumes, the remote state is resynchronized and reconciled.

---

## 4. Migration & Zero Data Loss Strategy

To migrate without losing production user accounts in Cognito or weekly report archives in S3, we used a three-step retention and adoption protocol:

1. **CF Retain Policy**: Stacks are marked with `DeletionPolicy: Retain` and `UpdateReplacePolicy: Retain` before deletion, orphaned safely in AWS.
2. **Terraform Import**: Declarative `import` blocks in `infra/imports.tf` map resource addresses to live AWS IDs:
   - User Pool: `us-east-1_dLIUUyTHp`
   - Client: `us-east-1_dLIUUyTHp/6s22d1p7brc05pss5gpkuvalnv`
   - S3 Bucket: `spry-shkunda-reports-783216615378`
   - SQS Queue: `spry-shkunda-report-requests`
   - Agenda Parser URL: `spry-shkunda-agenda-parser`
3. **Plan Reconciliation**: Verification that `terraform plan` outputs `Plan: X to import, 0 to add, 0 to change, 0 to destroy` before applying, followed by `No changes. Your infrastructure matches the configuration.`

---

## 5. Consequences

### Positive
- **Unified Tooling**: Single configuration syntax for AWS infrastructure, Google Cloud OAuth, and future providers.
- **Idempotency & Drift Detection**: Any out-of-band console change is immediately flagged during the next speculative plan.
- **Automated Concurrency Locking**: HCP Terraform prevents simultaneous runs from competing team members.
- **Clean Architecture**: Eliminates CloudFormation's circular dependency between S3 and Lambda notification permissions by modeling `aws_s3_bucket_notification` as an independent child resource.

### Trade-offs & Mitigations
- **BSL Licensing**: Terraform moved to BSL 1.1 in 2023. Mitigated by maintaining strict HCL compatibility with OpenTofu if migration is ever needed.
- **State File Gravity**: State must be protected as a critical asset. Mitigated by hosting in managed, encrypted HCP Terraform workspaces with automated backups and versioning.
