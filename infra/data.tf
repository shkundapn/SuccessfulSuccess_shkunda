data "aws_caller_identity" "current" {}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [local.vpc_id]
  }
}

data "aws_route_tables" "default" {
  filter {
    name   = "vpc-id"
    values = [local.vpc_id]
  }
}

data "aws_security_groups" "backend_fn" {
  filter {
    name   = "vpc-id"
    values = [local.vpc_id]
  }
  filter {
    name   = "tag:PROJECT_NAME"
    values = [var.project_name]
  }
}

data "aws_lambda_function" "backend" {
  function_name = "${var.project_name}-backend"
}

locals {
  vpc_id             = var.vpc_id != "" ? var.vpc_id : data.aws_vpc.default.id
  subnet_ids         = length(var.subnet_ids) > 0 ? var.subnet_ids : data.aws_subnets.default.ids
  route_table_ids    = length(var.route_table_ids) > 0 ? var.route_table_ids : data.aws_route_tables.default.ids
  security_group_ids = length(var.security_group_ids) > 0 ? var.security_group_ids : data.aws_security_groups.backend_fn.ids
  image_uri          = var.image_uri != "" ? var.image_uri : data.aws_lambda_function.backend.image_uri
  database_url       = var.database_url != "" ? var.database_url : try(data.aws_lambda_function.backend.environment[0].variables["DATABASE_URL"], "")
}
