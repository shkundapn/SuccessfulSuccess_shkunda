# --- Auth Imports -------------------------------------------------------------
import {
  to = aws_cognito_user_pool.pool
  id = "us-east-1_dLIUUyTHp"
}

import {
  to = aws_cognito_user_pool_client.client
  id = "us-east-1_dLIUUyTHp/6s22d1p7brc05pss5gpkuvalnv"
}

import {
  to = aws_cognito_user_pool_domain.domain
  id = "spry-shkunda-783216615378"
}

import {
  to = aws_cognito_identity_provider.google[0]
  id = "us-east-1_dLIUUyTHp:Google"
}

import {
  to = aws_lambda_function.pre_sign_up
  id = "spry-shkunda-auto-confirm"
}

# --- Reports Imports ----------------------------------------------------------
import {
  to = aws_s3_bucket.reports
  id = "spry-shkunda-reports-783216615378"
}

import {
  to = aws_sqs_queue.report_queue
  id = "https://sqs.us-east-1.amazonaws.com/783216615378/spry-shkunda-report-requests"
}

import {
  to = aws_sqs_queue.report_dlq
  id = "https://sqs.us-east-1.amazonaws.com/783216615378/spry-shkunda-report-requests-dlq"
}

import {
  to = aws_scheduler_schedule.weekly
  id = "default/spry-shkunda-weekly-report"
}

import {
  to = aws_cloudwatch_log_group.builder
  id = "/aws/lambda/spry-shkunda-report-builder"
}

import {
  to = aws_lambda_function.builder
  id = "spry-shkunda-report-builder"
}

import {
  to = aws_cloudwatch_log_group.mailer
  id = "/aws/lambda/spry-shkunda-report-mailer"
}

import {
  to = aws_lambda_function.mailer
  id = "spry-shkunda-report-mailer"
}

# --- AI Imports ---------------------------------------------------------------
import {
  to = aws_cloudwatch_log_group.agenda_parser
  id = "/aws/lambda/spry-shkunda-agenda-parser"
}

import {
  to = aws_lambda_function.agenda_parser
  id = "spry-shkunda-agenda-parser"
}

import {
  to = aws_lambda_function_url.agenda_parser
  id = "spry-shkunda-agenda-parser"
}
