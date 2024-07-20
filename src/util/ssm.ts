import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export function getSsmSecret(name: string): pulumi.Output<string> {
    const result = pulumi.secret(aws.ssm.getParameter({
        name,
        withDecryption: true
    }));
    return result.apply(x => x.value);
}
