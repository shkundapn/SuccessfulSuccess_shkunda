"""Sync frontend/out to S3 bucket and create CloudFront invalidation."""

import mimetypes
import os
import boto3
import dotenv

dotenv.load_dotenv(".env")

aws_region = os.getenv("AWS_REGION", "us-east-1")
s3 = boto3.client(
    "s3",
    region_name=aws_region,
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    aws_session_token=os.getenv("AWS_SESSION_TOKEN"),
)
cf = boto3.client(
    "cloudfront",
    region_name=aws_region,
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    aws_session_token=os.getenv("AWS_SESSION_TOKEN"),
)

bucket = "spry-shkunda-frontend-783216615378"
distribution_id = "EC75YMH5NWA7D"
out_dir = os.path.join("frontend", "out")

print(f"Uploading {out_dir} to s3://{bucket}...")
upload_count = 0
for root, _, files in os.walk(out_dir):
    for f in files:
        full_path = os.path.join(root, f)
        rel_path = os.path.relpath(full_path, out_dir).replace("\\", "/")
        
        content_type, _ = mimetypes.guess_type(full_path)
        if not content_type:
            if f.endswith(".json"):
                content_type = "application/json"
            elif f.endswith(".txt"):
                content_type = "text/plain"
            else:
                content_type = "application/octet-stream"
        
        # Cache control: HTML files get no-cache, assets get immutable
        if f.endswith(".html"):
            cache_control = "no-cache"
        else:
            cache_control = "public,max-age=31536000,immutable"
            
        with open(full_path, "rb") as file_data:
            s3.put_object(
                Bucket=bucket,
                Key=rel_path,
                Body=file_data,
                ContentType=content_type,
                CacheControl=cache_control,
            )
        upload_count += 1

print(f"Uploaded {upload_count} files to S3.")

print(f"Invalidating CloudFront cache for distribution {distribution_id}...")
import time
inv = cf.create_invalidation(
    DistributionId=distribution_id,
    InvalidationBatch={
        "Paths": {
            "Quantity": 1,
            "Items": ["/*"],
        },
        "CallerReference": str(time.time()),
    },
)
print("Invalidation created:", inv["Invalidation"]["Id"], inv["Invalidation"]["Status"])
print("Frontend deployment complete! Live at: https://successfulsuccess.pp.ua")
