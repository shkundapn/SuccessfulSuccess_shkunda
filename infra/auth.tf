# --- IAM Role & Lambda for Pre-Sign-Up Auto-Confirm --------------------------
resource "aws_iam_role" "pre_sign_up" {
  name = "${var.project_name}-pre-signup-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "pre_sign_up_basic" {
  role       = aws_iam_role.pre_sign_up.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "archive_file" "pre_sign_up_zip" {
  type        = "zip"
  output_path = "${path.module}/pre_sign_up.zip"

  source {
    content = <<-EOT
def handler(event, context):
    event['response']['autoConfirmUser'] = True
    event['response']['autoVerifyEmail'] = True
    return event
EOT
    filename = "index.py"
  }
}

resource "aws_lambda_function" "pre_sign_up" {
  function_name    = "${var.project_name}-auto-confirm"
  runtime          = "python3.12"
  handler          = "index.handler"
  role             = aws_iam_role.pre_sign_up.arn
  filename         = data.archive_file.pre_sign_up_zip.output_path
  source_code_hash = data.archive_file.pre_sign_up_zip.output_base64sha256
}

# --- Cognito User Pool --------------------------------------------------------
resource "aws_cognito_user_pool" "pool" {
  name                     = "${var.project_name}-users"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  username_configuration {
    case_sensitive = false
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = false
    temporary_password_validity_days = 7
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  lambda_config {
    pre_sign_up = aws_lambda_function.pre_sign_up.arn
  }

  tags = {
    PROJECT_NAME = var.project_name
  }
}

resource "aws_lambda_permission" "pre_sign_up" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pre_sign_up.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.pool.arn
}

# --- Cognito User Pool Domain -------------------------------------------------
resource "aws_cognito_user_pool_domain" "domain" {
  domain       = "${var.project_name}-${data.aws_caller_identity.current.account_id}"
  user_pool_id = aws_cognito_user_pool.pool.id
}

# --- Google Identity Provider -------------------------------------------------
resource "aws_cognito_identity_provider" "google" {
  count        = var.google_client_id != "" ? 1 : 0
  user_pool_id = aws_cognito_user_pool.pool.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret
    authorize_scopes = "openid email profile"
  }

  attribute_mapping = {
    email          = "email"
    email_verified = "email_verified"
    name           = "name"
  }
}

# --- Cognito User Pool Client -------------------------------------------------
resource "aws_cognito_user_pool_client" "client" {
  name         = "${var.project_name}-web"
  user_pool_id = aws_cognito_user_pool.pool.id

  generate_secret               = false
  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_ADMIN_USER_PASSWORD_AUTH"
  ]

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  supported_identity_providers = var.google_client_id != "" ? ["COGNITO", "Google"] : ["COGNITO"]

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]

  callback_urls = var.app_urls
  logout_urls   = var.app_urls

  depends_on = [aws_cognito_identity_provider.google]
}
