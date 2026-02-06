provider "aws" {
  region = "us-east-1"
}

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  enable_dns_support = true
  enable_dns_hostnames = true
  tags = { Name = "directql-vpc" }
}

resource "aws_subnet" "public" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"
  map_public_ip_on_launch = true
}

resource "aws_security_group" "allow_web" {
  vpc_id = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_ecs_cluster" "cluster" {
  name = "directql-cluster"
}

resource "aws_ecs_task_definition" "app" {
  family                   = "directql-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024" # 1 vCPU
  memory                   = "4096" # 4 GB
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn

  container_definitions = jsonencode([
    {
      name      = "graphql-mcp"
      image     = "my-repo/graphql-mcp:latest"
      cpu       = 256
      memory    = 512
      essential = true
      portMappings = [{ containerPort = 3000 }]
      environment = [
        { name = "GRAPHQL_MCP_ENDPOINT", value = "https://api.github.com/graphql" }
      ]
    },
    {
      name      = "open-webui"
      image     = "ghcr.io/open-webui/open-webui:main"
      cpu       = 512
      memory    = 1024
      essential = true
      portMappings = [{ containerPort = 8080 }]
      environment = [
        { name = "PORT", value = "8080" },
        { name = "OPENAI_API_BASE_URL", value = "http://127.0.0.1:11434/v1" }
      ]
    },
    {
      name      = "ollama"
      image     = "ollama/ollama:latest"
      cpu       = 256
      memory    = 2048
      essential = true
      portMappings = [{ containerPort = 11434 }]
    }
  ])
}

resource "aws_ecs_service" "service" {
  name            = "directql-service"
  cluster         = aws_ecs_cluster.cluster.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public.id]
    security_groups  = [aws_security_group.allow_web.id]
    assign_public_ip = true
  }
}

# IAM Role for ECS Execution
resource "aws_iam_role" "ecs_execution_role" {
  name = "directql_ecs_execution_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_role_policy" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}
