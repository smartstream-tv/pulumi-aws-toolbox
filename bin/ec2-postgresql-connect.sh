#!/usr/bin/env bash
set -e

INSTANCE_ID=$1

aws ec2-instance-connect ssh --connection-type eice --instance-id "$INSTANCE_ID" --local-forwarding "5432:localhost:5432"
