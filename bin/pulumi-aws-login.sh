#!/usr/bin/env bash

if [ -z "$AWS_REGION" ]; then
  AWS_REGION=$(aws configure get region)
  if [ -z "$AWS_REGION" ]; then
    echo "AWS region could not be retrieved from AWS CLI configuration."
    exit 1
  fi
fi

set -e
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
BUCKET="pulumi-state-${AWS_REGION}-${AWS_ACCOUNT_ID}"

mkdir -p ~/.pulumi
cat >~/.pulumi/credentials.json <<EOL
{
    "current": "s3://${BUCKET}",
    "accessTokens": {
        "s3://${BUCKET}": ""
    },
    "accounts": {
        "s3://${BUCKET}": {
            "lastValidatedAt": "0001-01-01T00:00:00Z"
        }
    }
}
EOL

echo Configured Pulumi to use bucket s3://$BUCKET