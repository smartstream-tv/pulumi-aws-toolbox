import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { S3Artifact } from "../build/S3Artifact";
import { CloudfrontLogBucket } from "./CloudfrontLogBucket";
import { SingleAssetBucket } from "./SingleAssetBucket";
import { ViewerRequestFunction, ViewerResponseFunction } from "./cloudfront-function";
import { createCloudfrontDnsRecords, stdCacheBehavior } from "./utils";

/**
 * Creates a CloudFront distribution and a number of supporting resources to create a mostly static website.
 * See the README.md for the full documentation.
 */
export class StaticWebsite extends pulumi.ComponentResource {
    readonly name: string;
    readonly domain: pulumi.Output<string>;

    private args: WebsiteArgs;
    private distribution: aws.cloudfront.Distribution;

    constructor(name: string, args: WebsiteArgs, opts?: pulumi.CustomResourceOptions) {
        super("pat:website:StaticWebsite", name, args, opts);
        this.args = args;
        this.name = name;

        const zone = aws.route53.Zone.get("zone", args.hostedZoneId);
        this.domain = args.subDomain ? pulumi.interpolate`${args.subDomain}.${zone.name}` : zone.name;

        const stdViewerRequest = args.basicAuth ?
            new ViewerRequestFunction(`${name}-std-viewer-request`, this)
                .withBasicAuth(args.basicAuth.username, args.basicAuth.password)
                .withIndexRewrite()
                .build() :
            new ViewerRequestFunction(`${name}-std-viewer-request`, this)
                .withIndexRewrite()
                .build();

        const stdViewerResponse = new ViewerResponseFunction(`${name}-std-viewer-response`, this)
            .withCacheControl(false)
            .withSecurityHeaders()
            .build();

        const oac = new aws.cloudfront.OriginAccessControl(name, {
            originAccessControlOriginType: "s3",
            signingBehavior: "always",
            signingProtocol: "sigv4",
        }, { parent: this });

        const defaultOriginId = "default";

        const immutableViewerResponse = new ViewerResponseFunction(`${name}-immutable-response`, this).withCacheControl(true).build();
        const immutableCacheBehaviors = (args.immutablePaths ? args.immutablePaths : []).map(pathPattern => ({
            ...stdCacheBehavior(),
            pathPattern,
            targetOriginId: defaultOriginId,
            functionAssociations: [stdViewerRequest, immutableViewerResponse],
        }));

        const logBucket = new CloudfrontLogBucket(`${name}-log`, {}, { parent: this });

        const singleAssetBucket = new SingleAssetBucket(`${name}-asset`, {
            assets: (args.integrations ?? []).filter(i => i.type == "SingleAssetIntegration").map(i => {
                const integration = i as SingleAssetIntegration;
                return {
                    content: integration.content,
                    contentType: integration.contentType,
                    path: integration.path,
                };
            })
        }, { parent: this });

        this.distribution = new aws.cloudfront.Distribution(name, {
            origins: [
                {
                    originId: defaultOriginId,
                    domainName: args.assets.bucket.bucketRegionalDomainName,
                    originAccessControlId: oac.id,
                    originPath: '/' + args.assets.getPath(),
                },
                singleAssetBucket.getOriginConfig(oac),
            ],
            originGroups: [],
            enabled: true,
            isIpv6Enabled: true,
            comment: `${name}`,
            aliases: [this.domain],
            defaultRootObject: "index.html",
            defaultCacheBehavior: {
                ...stdCacheBehavior(),
                targetOriginId: defaultOriginId,
                functionAssociations: [stdViewerRequest, stdViewerResponse],
            },
            orderedCacheBehaviors: [
                ...(singleAssetBucket.assets.map((asset) => ({
                    ...stdCacheBehavior(),
                    pathPattern: asset.path,
                    targetOriginId: singleAssetBucket.originId,
                    functionAssociations: [stdViewerRequest, stdViewerResponse],
                }))),
                ...immutableCacheBehaviors
            ],
            priceClass: "PriceClass_100",
            restrictions: {
                geoRestriction: {
                    restrictionType: "none"
                },
            },
            viewerCertificate: {
                acmCertificateArn: args.acmCertificateArn_usEast1,
                minimumProtocolVersion: "TLSv1.2_2021",
                sslSupportMethod: "sni-only"
            },
            customErrorResponses: [
                {
                    errorCode: 404,
                    responseCode: 404,
                    responsePagePath: "/404.html",
                },
            ],
            loggingConfig: {
                bucket: logBucket.bucketRegionalDomainName,
                includeCookies: false
            },
        }, {
            parent: this,
            deleteBeforeReplace: true
        });

        this.args.assets.requestCloudfrontReadAccess(this.distribution.arn);

        singleAssetBucket.setupAccessPolicy(this.distribution.arn);

        createCloudfrontDnsRecords(name, this.distribution, zone.id, args.subDomain, this);
    }
}


export interface WebsiteArgs {
    /**
     * ARN of the HTTPS certificate. The ACM certificate must be created in the us-east-1 region!
     */
    readonly acmCertificateArn_usEast1: string;

    /**
     * A S3 bucket location with the default assets that should be delivered.
     * 
     * You must make sure the bucket as a resource policy that allows read access from CloudFront.
     * If you're using S3ArtifactStore, this can be achieved by calling it's createBucketPolicy method.
     */
    readonly assets: S3Artifact;

    /**
     * Integrates additional assets using CloudFront cache behaviours.
     */
    readonly integrations?: (SingleAssetIntegration | BucketIntegration | ApiIntegration)[];

    /**
     * Optionally, protects the website with HTTP basic auth.
     */
    readonly basicAuth?: BasicAuthArgs;

    /**
     * Path patterns that should be treated as immutable.
     * Example: "/_astro/*"
     */
    readonly immutablePaths?: string[];

    readonly hostedZoneId: string;

    /**
     * The subdomain within the hosted zone or null if the zone apex should be used.
     */
    readonly subDomain?: string;
}

export type SingleAssetIntegration = {
    readonly type: "SingleAssetIntegration";
    /**
     * Must start with a slash.
     */
    readonly path: string;
    readonly content: string | pulumi.Output<string>;
    readonly contentType: string;
}

export type BucketIntegration = {
    readonly type: "BucketIntegration";
    readonly pathPattern: string;
    readonly artifact: S3Artifact;
    readonly immutable: boolean;
}

export type ApiIntegration = {
    readonly type: "ApiIntegration";
    readonly pathPattern: string;
    readonly originDomain: pulumi.Output<string>;
}

export interface BasicAuthArgs {
    readonly username: string;
    readonly password: string;
}
