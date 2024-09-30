import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { ComponentResourceOptions } from "@pulumi/pulumi";
import { RoleInlinePolicy, SimpleNodeLambda } from "../lambda";

/**
 * Creates a AWS Lambda to send email using SES.
 * 
 * It acts as a proxy for the SendRawEmail command, allowing you
 *  - to send email from a private subnet using IPv6 (SES doesn't support IPv6 yet)
 *  - to send email from a different account by assuming another role.
 * 
 * You can control who can send email, by configuring who can invoke this lambda.
 * If 'assumeRoleArn' isn't specified the lambda can send email via any configured SES identity.
 */
export class SesProxyMailer extends SimpleNodeLambda {
    constructor(name: string, args: SesProxyMailerArgs, opts?: ComponentResourceOptions) {
        super(name, {
            codeDir: `${__dirname}/../../resources/ses-proxy-mailer`,
            roleInlinePolicies: [
                ...(args.assumeRoleArn ? [{
                    name: "STS",
                    policy: {
                        Version: "2012-10-17",
                        Statement: [{
                            Effect: "Allow",
                            Action: ["sts:AssumeRole"],
                            Resource: [args.assumeRoleArn]
                        }]
                    }
                } as RoleInlinePolicy] : [{
                    name: "SES",
                    policy: {
                        Version: "2012-10-17",
                        Statement: [{
                            Effect: "Allow",
                            Action: "ses:SendRawEmail",
                            Resource: "*",
                        }]
                    }
                } as RoleInlinePolicy])
            ],
            environmentVariables: {
                ...(args.assumeRoleArn ? {ASSUME_ROLE_ARN: args.assumeRoleArn} : {}),
                REGION: args.region ?? aws.getRegionOutput().name,
            },
        }, opts, "pat:ses:SesProxyMailer");
    }
}

export interface SesProxyMailerArgs {
    assumeRoleArn?: pulumi.Input<string>;

    /**
     * Optionally, specify which regional SES service to use.
     */
    region?: pulumi.Input<string>;
}
