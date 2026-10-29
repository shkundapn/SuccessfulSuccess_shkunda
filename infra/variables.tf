variable "project_name" {
  type        = string
  default     = "spry-shkunda"
  description = "Prefix applied to names of all resources and PROJECT_NAME tag."
}

variable "region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region for resources."
}

variable "app_urls" {
  type        = list(string)
  default     = ["http://localhost:3000/", "https://successfulsuccess.pp.ua/"]
  description = "Allowed redirect and sign-out URLs for Cognito."
}

variable "google_client_id" {
  type        = string
  default     = "628976317961-vqq9ve4tnhkcg24u7khrt0f5279hqadd.apps.googleusercontent.com"
  description = "Google OAuth 2.0 Web Client ID."
}

variable "GOOGLE_CLIENT_ID" {
  type        = string
  default     = ""
  description = "Google OAuth 2.0 Web Client ID (uppercase alias from HCP Terraform)."
}

variable "google_client_secret" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Google OAuth 2.0 Client Secret (sensitive, passed via HCP Terraform workspace)."
}

variable "GOOGLE_CLIENT_SECRET" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Google OAuth 2.0 Client Secret (uppercase alias from HCP Terraform)."
}

variable "recipient_email" {
  type        = string
  default     = "maksym.shkunda.25@cnu.edu.ua"
  description = "Verified SES recipient email for weekly reports."
}

variable "sender_email" {
  type        = string
  default     = "maksym.shkunda.25@cnu.edu.ua"
  description = "Verified SES sender email for weekly reports."
}

variable "app_timezone" {
  type        = string
  default     = "Europe/Kyiv"
  description = "Default timezone for reporting schedule and AI relative dates."
}

variable "parser_model" {
  type        = string
  default     = "amazon.nova-lite-v1:0"
  description = "Amazon Bedrock foundation model ID for agenda parser."
}

variable "architecture" {
  type        = string
  default     = "x86_64"
  description = "Architecture for backend-derived Lambda containers (x86_64 or arm64)."
}

variable "cors_origins" {
  type        = string
  default     = "*"
  description = "Comma-separated CORS origins or wildcard for agenda parser."
}

variable "cognito_jwks" {
  type        = string
  default     = ""
  description = "Optional static JWKS base64 string for offline token verification."
}

variable "vpc_id" {
  type        = string
  default     = ""
  description = "VPC ID for VPC Lambda. If empty, automatically detected from default VPC."
}

variable "subnet_ids" {
  type        = list(string)
  default     = []
  description = "Subnet IDs for report builder Lambda. If empty, automatically detected."
}

variable "route_table_ids" {
  type        = list(string)
  default     = []
  description = "Route table IDs for S3 Gateway VPC Endpoint. If empty, automatically detected."
}

variable "security_group_ids" {
  type        = list(string)
  default     = []
  description = "Security group IDs for report builder Lambda. If empty, automatically detected."
}

variable "image_uri" {
  type        = string
  default     = ""
  description = "Backend container image URI. If empty, automatically read from backend Lambda."
}

variable "database_url" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Database connection URL. If empty, automatically read from backend Lambda."
}
