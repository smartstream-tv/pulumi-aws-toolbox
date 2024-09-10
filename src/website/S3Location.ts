import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

/**
 * References data stored in S3.
 */
export interface S3Location {

    /**
     * Returns the bucket name.
     */
    getBucket(): aws.s3.BucketV2;

    /**
     * Returns the path inside the bucket where the data is located.
     * Starts without a slash, and ends without a slash.
     * Example: "frontend/abcd1234"
     */
    getPath(): pulumi.Output<string>;

    /**
     * If CloudFront needs read access to this data, it can be requested by calling this method.
     */
    requestCloudfrontReadAccess(arn: pulumi.Input<aws.ARN>): void;

}
