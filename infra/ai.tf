# --- Agenda Parser Role & Policies (outside VPC, calls Bedrock) -------------
resource "aws_iam_role" "agenda_parser" {
  name = "${var.project_name}-agenda-parser-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "agenda_parser_basic" {
  role       = aws_iam_role.agenda_parser.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "agenda_parser_bedrock" {
  name = "BedrockInferencePolicy"
  role = aws_iam_role.agenda_parser.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "bedrock-mantle:CreateInference",
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:Converse",
        "bedrock:ConverseStream",
        "bedrock:ListFoundationModels"
      ]
      Resource = "*"
    }]
  })
}

# --- CloudWatch Log Group for Agenda Parser -----------------------------------
resource "aws_cloudwatch_log_group" "agenda_parser" {
  name              = "/aws/lambda/${var.project_name}-agenda-parser"
  retention_in_days = 7
}

# --- Agenda Parser Lambda Function --------------------------------------------
resource "aws_lambda_function" "agenda_parser" {
  function_name = "${var.project_name}-agenda-parser"
  description   = "Paste an agenda parser calling Amazon Bedrock outside VPC"
  package_type  = "Image"
  image_uri     = local.image_uri
  architectures = [var.architecture]
  role          = aws_iam_role.agenda_parser.arn
  memory_size   = 512
  timeout       = 30

  image_config {
    command = ["app.ai.agenda_lambda.handler"]
  }

  environment {
    variables = {
      PROJECT_NAME         = var.project_name
      PARSER_MODEL         = var.parser_model
      APP_TIMEZONE         = var.app_timezone
      CORS_ORIGINS         = var.cors_origins
      COGNITO_REGION       = var.region
      COGNITO_USER_POOL_ID = aws_cognito_user_pool.pool.id
      COGNITO_CLIENT_ID    = aws_cognito_user_pool_client.client.id
      COGNITO_JWKS         = var.cognito_jwks
    }
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.agenda_parser.name
  }

  depends_on = [aws_cloudwatch_log_group.agenda_parser]
}

# --- Public Lambda Function URL & Public Invoke Permission --------------------
resource "aws_lambda_function_url" "agenda_parser" {
  function_name      = aws_lambda_function.agenda_parser.function_name
  authorization_type = "NONE"
  invoke_mode        = "BUFFERED"
}

resource "aws_lambda_permission" "agenda_parser_url" {
  statement_id           = "FunctionUrlAllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.agenda_parser.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}
