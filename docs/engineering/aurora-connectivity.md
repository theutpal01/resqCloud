# Aurora demo connectivity

The recommended Aurora PostgreSQL express configuration uses an AWS-managed internet access gateway and IAM database authentication. It is not associated with a VPC, so there is no DB security group to open to the laptop. Access is controlled by the IAM `rds-db:connect` permission, the PostgreSQL `rds_iam` role, and TLS. Scope the IAM resource ARN to the cluster resource ID and application DB username.

If you choose Aurora full configuration instead, the database is associated with a VPC. For a temporary laptop demo, public access may be needed; allow PostgreSQL TCP 5432 from your current public IPv4 address only (`/32`). Never allow `0.0.0.0/0`. Update or remove that rule when the demo ends. Full configuration has different pricing and networking, so review both before creating it.

The app and API run locally in either setup. This project does not create a custom VPC, subnets, NAT Gateway, ALB or AWS-hosted compute.
