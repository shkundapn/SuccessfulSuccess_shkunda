# --- Auth Outputs -------------------------------------------------------------
output "UserPoolId" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.pool.id
}

output "UserPoolClientId" {
  description = "Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.client.id
}

output "Issuer" {
  description = "The iss of every token"
  value       = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.pool.id}"
}

output "HostedDomain" {
  description = "Cognito OAuth hosted domain"
  value       = "${aws_cognito_user_pool_domain.domain.domain}.auth.${var.region}.amazoncognito.com"
}

output "GoogleRedirectUri" {
  description = "Redirect URI for Google Cloud OAuth client"
  value       = "https://${aws_cognito_user_pool_domain.domain.domain}.auth.${var.region}.amazoncognito.com/oauth2/idpresponse"
}

output "GoogleEnabled" {
  description = "Whether Google authentication is enabled"
  value       = nonsensitive(local.google_client_id != "" ? "true" : "false")
}

# --- Reports Outputs ----------------------------------------------------------
output "ReportsBucketName" {
  description = "S3 bucket where reports are stored"
  value       = aws_s3_bucket.reports.id
}

output "ReportQueueUrl" {
  description = "SQS Queue URL for report requests"
  value       = aws_sqs_queue.report_queue.id
}

output "ReportQueueArn" {
  description = "SQS Queue ARN"
  value       = aws_sqs_queue.report_queue.arn
}

output "ReportDlqUrl" {
  description = "SQS Dead-Letter Queue URL"
  value       = aws_sqs_queue.report_dlq.id
}

output "BuilderFunctionName" {
  description = "Report Builder Lambda Function Name"
  value       = aws_lambda_function.builder.function_name
}

output "MailerFunctionName" {
  description = "Report Mailer Lambda Function Name"
  value       = aws_lambda_function.mailer.function_name
}

output "ScheduleName" {
  description = "EventBridge Scheduler Name"
  value       = aws_scheduler_schedule.weekly.name
}

# --- AI Outputs ---------------------------------------------------------------
output "AgendaParserUrl" {
  description = "Public function URL for the agenda parser (without trailing slash)"
  value       = trimsuffix(aws_lambda_function_url.agenda_parser.function_url, "/")
}

output "AgendaParserFunctionName" {
  description = "Agenda Parser Lambda function name"
  value       = aws_lambda_function.agenda_parser.function_name
}

output "AgendaParserLogGroup" {
  description = "CloudWatch log group for agenda parser"
  value       = aws_cloudwatch_log_group.agenda_parser.name
}
