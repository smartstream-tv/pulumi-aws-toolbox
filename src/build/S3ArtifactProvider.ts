import * as aws from "@pulumi/aws";
import { S3Artifact, getS3ArtifactForBucket } from "./S3Artifact";

export interface S3ArtifactProvider {
    getArtifactVersion(version: string): S3Artifact;
}

export function getArtifactProviderForExistingBucket(bucket: aws.s3.Bucket, artifactName: string): S3ArtifactProvider {
    return {
        getArtifactVersion(version: string): S3Artifact {
            return getS3ArtifactForBucket(bucket, artifactName, version);
        }
    };
}
