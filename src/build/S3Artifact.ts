import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { S3Location } from "../website/S3Location";

/**
 * References a build artifact stored in S3. The S3Artifact references an entire directory in S3, not a single file.
 * An artifact could be
 *  - a directory containing the static assets of a website,
 *  - a directory containing a single ZIP file containing the code to be executed by AWS Lambda.
 *
 * An artifact is identified by
 * - a name e.g. "frontend"
 * - a version e.g. a Git commit hash
 */
export class S3Artifact implements S3Location {
    /**
     * The bucket.
     */
    readonly bucket: aws.s3.BucketV2;

    /**
     * The name of the artifact.
     */
    readonly name: string;

    /**
     * The version of the artifact.
     */
    readonly version: string;

    private requestAccess: RequestReadAccessFunction;

    constructor(bucket: aws.s3.BucketV2, name: string, version: string, requestCloudfrontReadAccess: RequestReadAccessFunction) {
        this.bucket = bucket;
        this.name = name;
        this.version = version;
        this.requestAccess = requestCloudfrontReadAccess;
    }

    getBucket() {
        return this.bucket;
    }

    getPath() {
        return pulumi.interpolate`${this.name}/${this.version}`;
    };


    requestCloudfrontReadAccess(arn: pulumi.Input<aws.ARN>) {
        return this.requestAccess(arn);
    }
}

export type RequestReadAccessFunction = (arn: pulumi.Input<aws.ARN>) => void;

/**
 * Returns a S3 artifact for an existing bucket.
 * The bucket may have been manually created to share artifacts across stacks.
 * The bucket must already allow proper read access.
 */
export function getS3ArtifactForBucket(
    bucket: aws.s3.BucketV2,
    artifactName: string,
    version: string
): S3Artifact {
    return new S3Artifact(bucket, artifactName, version, () => {
        // ignored - not supported
    });
}
