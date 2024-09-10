import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export function createCloudfrontDnsRecords(name: string, distribution: aws.cloudfront.Distribution, zoneId: pulumi.Input<string>, subDomain?: pulumi.Input<string>, opts?: pulumi.ComponentResourceOptions) {
    const cloudfrontZoneId = "Z2FDTNDATAQYW2";

    new aws.route53.Record(`${name}-a`, {
        zoneId,
        name: subDomain || "",
        type: "A",
        aliases: [{
            zoneId: cloudfrontZoneId,
            name: distribution.domainName,
            evaluateTargetHealth: false
        }]
    }, { ...opts, deleteBeforeReplace: true });

    new aws.route53.Record(`${name}-aaaa`, {
        zoneId,
        name: subDomain || "",
        type: "AAAA",
        aliases: [{
            zoneId: cloudfrontZoneId,
            name: distribution.domainName,
            evaluateTargetHealth: false
        }]
    }, { ...opts, deleteBeforeReplace: true });
}
