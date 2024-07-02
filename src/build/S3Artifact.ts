import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

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
export class S3Artifact {
    /**
     * The bucket.
     */
    readonly bucket: aws.s3.Bucket;

    /**
     * The name of the artifact.
     */
    readonly name: string;

    /**
        The version of the artifact.
      */
    readonly version: string;

    private requestAccess: RequestReadAccessFunction;

    constructor(bucket: aws.s3.Bucket, name: string, version: string, requestCloudfrontReadAccess: RequestReadAccessFunction) {
        this.bucket = bucket;
        this.name = name;
        this.version = version;
        this.requestAccess = requestCloudfrontReadAccess;
    }

    /**
     * Returns the path inside the bucket where the artifact is located.
     * Start without a slash, and ends without a slash.
     * Example: "frontend/abcd1234"
     */
    getPath() {
        return `${this.name}/${this.version}`;
    };

    /**
     * The component using this artifact (e.g. AWS Lambda / CloudFront) needs read access to the artifact, which they can request by calling this method.
     */
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
    bucket: aws.s3.Bucket,
    artifactName: string,
    version: string
): S3Artifact {
    return new S3Artifact(bucket, artifactName, version, () => {
        // ignored - not supported
    });
}
