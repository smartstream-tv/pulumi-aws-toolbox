import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export async function createHostDnsRecords(name: string, fullDomain: pulumi.Input<string>, ipv4Address: pulumi.Input<string>, ipv6Address: pulumi.Input<string>, ttl: number, opts?: pulumi.ComponentResourceOptions) {
    const { subdomain, zoneDomain } = pulumi.output(fullDomain).apply(domain => parseFullDomain(domain));

    const hostedZone = zoneDomain.apply(domain => aws.route53.getZone({ name: domain }));

    new aws.route53.Record(`${name}-a`, {
        zoneId: hostedZone.zoneId,
        name: subdomain,
        type: "A",
        ttl,
        records: [ipv4Address],
    }, opts);

    new aws.route53.Record(`${name}-aaaa`, {
        zoneId: hostedZone.zoneId,
        name: subdomain,
        type: "AAAA",
        ttl,
        records: [ipv6Address],
    }, opts);
}

function parseFullDomain(fullDomain: string) {
    const parts = fullDomain.split(".");
    if (parts.length < 3) {
        throw new Error(`Domain name ${fullDomain} must include at least one subdomain.`);
    }
    const subdomain = parts.slice(0, parts.length - 2).join(".");
    const zoneDomain = parts.slice(parts.length - 2).join(".");
    return { subdomain, zoneDomain };
}
