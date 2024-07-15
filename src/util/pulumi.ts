import * as pulumi from "@pulumi/pulumi";

export async function resolveOutput<T>(input: pulumi.Output<T>) {
    return new Promise((resolve, reject) => {
        try {
            input.apply(resolve);
        } catch (err) {
            reject(err);
        }
    });
}
