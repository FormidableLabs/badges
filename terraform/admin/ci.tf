resource "aws_s3_bucket" "artifacts" {
  # Previously we weren't deploying this when working with production
  count = 1

  bucket        = "${local.prefix}-artifacts-${local.account_id}"
  acl           = "private"
  force_destroy = true

  # CodePipeline requires versioned buckets.
  versioning {
    enabled = true
  }

  tags = local.tags
}