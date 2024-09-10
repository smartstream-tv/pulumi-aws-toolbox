import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { CloudfrontLogBucket } from "./CloudfrontLogBucket";
import { S3Location } from "./S3Location";
import { SingleAssetBucket } from "./SingleAssetBucket";
import { ViewerRequestFunction, ViewerResponseFunction } from "./cloudfront-function";
import { createCloudfrontDnsRecords } from "./utils";

/**
 * Opinionated component for hosting a website.
 * Creates a CloudFront distribution and a number of supporting resources.
 * See the README.md for the full documentation.
 */
export class StaticWebsite extends pulumi.ComponentResource {
    readonly name: string;
    readonly domain: pulumi.Output<string>;

    private distribution: aws.cloudfront.Distribution;

    constructor(name: string, args: WebsiteArgs, opts?: pulumi.CustomResourceOptions) {
        super("pat:website:StaticWebsite", name, args, opts);
        this.name = name;

        const defaultRoute = args.routes.at(-1)!;
        if (defaultRoute.pathPattern !== "/") {
            throw new Error("The default route must use path pattern '/'");
        }

        const zone = aws.route53.Zone.get("zone", args.hostedZoneId);
        this.domain = args.subDomain ? pulumi.interpolate`${args.subDomain}.${zone.name}` : zone.name;

        const s3ViewerRequest = args.basicAuth ?
            new ViewerRequestFunction(`${name}-s3-viewer-request`, this)
                .withBasicAuth(args.basicAuth.username, args.basicAuth.password)
                .withIndexRewrite()
                .build() :
            new ViewerRequestFunction(`${name}-s3-viewer-request`, this)
                .withIndexRewrite()
                .build();

        const apiViewerRequest = args.basicAuth ?
            new ViewerRequestFunction(`${name}-api-viewer-request`, this)
                .withBasicAuth(args.basicAuth.username, args.basicAuth.password)
                .build() :
            new ViewerRequestFunction(`${name}-api-viewer-request`, this)
                .build();

        const stdViewerResponse = new ViewerResponseFunction(`${name}-std-viewer-response`, this)
            .withCacheControl(false)
            .withSecurityHeaders()
            .build();

        const immutableViewerResponse = new ViewerResponseFunction(`${name}-immutable-response`, this).withCacheControl(true).build();

        const s3OriginAccessControl = new aws.cloudfront.OriginAccessControl(name, {
            originAccessControlOriginType: "s3",
            signingBehavior: "always",
            signingProtocol: "sigv4",
        }, { parent: this });

        const lambdaOriginAccessControl = new aws.cloudfront.OriginAccessControl(`${name}-lambda`, {
            originAccessControlOriginType: "lambda",
            signingBehavior: "always",
            signingProtocol: "sigv4",
        }, { parent: this });

        const logBucket = new CloudfrontLogBucket(`${name}-log`, {}, { parent: this });

        const singleAssetBucket = new SingleAssetBucket(`${name}-asset`, {
            assets: args.routes.filter(r => r.type == RouteType.SingleAsset).map(route => ({
                content: route.content,
                contentType: route.contentType,
                path: route.pathPattern,
            }))
        }, { parent: this });

        this.distribution = new aws.cloudfront.Distribution(name, {
            origins: args.routes.map((route => {
                if (route.type == RouteType.Lambda) {
                    return {
                        originId: `route-${route.pathPattern}`,
                        domainName: route.functionUrl.functionUrl.apply(url => new URL(url).host),
                        originAccessControlId: lambdaOriginAccessControl.id,
                        customOriginConfig: {
                            httpPort: 80,
                            httpsPort: 443,
                            originProtocolPolicy: "https-only",
                            originSslProtocols: ["TLSv1.2"]
                        },
                    };
                } else if (route.type == RouteType.S3) {
                    return {
                        originId: `route-${route.pathPattern}`,
                        domainName: route.s3Location.getBucket().bucketRegionalDomainName,
                        originAccessControlId: s3OriginAccessControl.id,
                        originPath: pulumi.interpolate`/${route.s3Location.getPath()}`,
                    };
                } else if (route.type == RouteType.SingleAsset) {
                    return {
                        originId: `route-${route.pathPattern}`,
                        domainName: singleAssetBucket.getBucket().bucketRegionalDomainName,
                        originAccessControlId: s3OriginAccessControl.id,
                    };
                } else {
                    throw new Error(`Unsupported route ${route}`);
                }
            }) as ((route: Route) => aws.types.input.cloudfront.DistributionOrigin)),
            enabled: true,
            isIpv6Enabled: true,
            httpVersion: "http2and3",
            comment: `${name}`,
            aliases: [this.domain],
            defaultRootObject: "index.html",
            orderedCacheBehaviors: args.routes.slice(0, -1).map((route => {
                if (route.type == RouteType.Lambda) {
                    return {
                        pathPattern: route.pathPattern,
                        targetOriginId: `route-${route.pathPattern}`,
                        allowedMethods: ["HEAD", "DELETE", "POST", "GET", "OPTIONS", "PUT", "PATCH"],
                        cachedMethods: ["HEAD", "GET"],
                        cachePolicyId: aws.cloudfront.getCachePolicyOutput({ name: "Managed-CachingDisabled" }).id,
                        compress: true,
                        viewerProtocolPolicy: "redirect-to-https",
                        originRequestPolicyId: aws.cloudfront.getOriginRequestPolicyOutput({ name: 'Managed-AllViewerExceptHostHeader' }).id,
                        functionAssociations: [apiViewerRequest, stdViewerResponse],
                    };
                } else if (route.type == RouteType.S3) {
                    return {
                        ...stdCacheBehavior(),
                        pathPattern: route.pathPattern,
                        targetOriginId: `route-${route.pathPattern}`,
                        functionAssociations: [s3ViewerRequest, route.immutable ? immutableViewerResponse : stdViewerResponse],
                    };
                } else if (route.type == RouteType.SingleAsset) {
                    return {
                        ...stdCacheBehavior(),
                        pathPattern: route.pathPattern,
                        targetOriginId: `route-${route.pathPattern}`,
                        functionAssociations: [s3ViewerRequest, stdViewerResponse],
                    };
                } else {
                    throw new Error(`Unsupported route ${route}`);
                }
            }) as ((route: Route) => aws.types.input.cloudfront.DistributionOrderedCacheBehavior)),
            defaultCacheBehavior: {
                ...stdCacheBehavior(),
                targetOriginId: `route-/`,
                functionAssociations: [s3ViewerRequest, stdViewerResponse],
            },
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
            waitForDeployment: false,
        }, {
            parent: this,
            deleteBeforeReplace: true
        });

        // request read access to S3
        args.routes.filter(r => r.type == RouteType.S3).forEach(route => {
            route.s3Location.requestCloudfrontReadAccess(this.distribution.arn);
        });

        // grant ourselves access to relevant lambda function URLs
        args.routes.filter(r => r.type == RouteType.Lambda).forEach(route => {
            new aws.lambda.Permission(`${name}-${route.pathPattern}`, {
                statementId: pulumi.interpolate`cloudfront-${this.distribution.id}`,
                action: "lambda:InvokeFunctionUrl",
                principal: "cloudfront.amazonaws.com",
                sourceArn: this.distribution.arn,
                function: route.functionUrl.functionName,
            }, { parent: this });
        });

        singleAssetBucket.setupAccessPolicy(this.distribution.arn);

        createCloudfrontDnsRecords(name, this.distribution, zone.id, args.subDomain, { parent: this });
    }
}


export interface WebsiteArgs {
    /**
     * ARN of the HTTPS certificate. The ACM certificate must be created in the us-east-1 region!
     */
    readonly acmCertificateArn_usEast1: string;

    /**
     * Optionally, protects the website with HTTP basic auth.
     */
    readonly basicAuth?: BasicAuthArgs;

    readonly hostedZoneId: string;

    /**
     * Specifies the routes to be served.
     * The first route to match a requested path wins.
     * The last route must use path pattern "/", and is the default route.
     * 
     * Internally, this gets translated into CloudFront cache behaviors.
     */
    readonly routes: Route[];

    /**
     * The subdomain within the hosted zone or null if the zone apex should be used.
     */
    readonly subDomain?: string;
}

export type Route = LambdaRoute | S3Route | SingleAssetRoute;

export enum RouteType {
    Lambda,
    SingleAsset,
    S3,
}

/**
 * Serves the given route from a Lambda function.
 * 
 * The function may use AWS_IAM for authentication.
 * Requests to the function URL will get signed and a invoke permission is automatically added.
 */
export type LambdaRoute = {
    readonly type: RouteType.Lambda;
    readonly pathPattern: string;

    /**
     * The function URL resource to integrate.
     */
    readonly functionUrl: aws.lambda.FunctionUrl;
}

/**
 * Serves the given route from a S3 bucket location.
 * 
 * You must make sure the bucket as a resource policy that allows read access from CloudFront.
 * If you're using S3ArtifactStore, this can be achieved by calling it's createBucketPolicy method.
 */
export type S3Route = {
    readonly type: RouteType.S3;
    readonly pathPattern: string;
    readonly s3Location: S3Location;

    /**
     * The resources can be treated as immutable, meaning, they can be cached forever.
     * Is false by default.
     */
    readonly immutable?: boolean;
}

export type SingleAssetRoute = {
    readonly type: RouteType.SingleAsset;
    /**
     * Must start with a slash. Must not contain wildcard characters.
     */
    readonly pathPattern: string;
    readonly content: string | pulumi.Output<string>;
    readonly contentType: string;
}

export interface BasicAuthArgs {
    readonly username: string;
    readonly password: string;
}

/**
 * Simple cache behavior for S3 that caches responses for up to one minute.
 */
function stdCacheBehavior() {
    return {
        allowedMethods: ["HEAD", "GET"],
        cachedMethods: ["HEAD", "GET"],
        viewerProtocolPolicy: "redirect-to-https",
        minTtl: 60,
        defaultTtl: 60,
        maxTtl: 60,
        forwardedValues: {
            cookies: {
                forward: "none",
            },
            headers: [],
            queryString: false,
        },
        compress: true,
    };
}
