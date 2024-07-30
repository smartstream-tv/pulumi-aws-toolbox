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

export function delayedOutput<T>(input: pulumi.Output<T>, millis: number): pulumi.Output<T> {
    return input.apply(async (x) => {
        await delay(millis);
        return x;
    });
}

export async function delay(millis: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, millis);
    });
}
