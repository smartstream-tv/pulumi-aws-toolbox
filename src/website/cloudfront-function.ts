import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { ComponentResource } from "@pulumi/pulumi";
const fs = require("fs");

export class ViewerRequestFunction {
    private eventType: EventType = "viewer-request";
    private handlerChain: Handler[] = [];
    private name: string;
    private parent?: ComponentResource;

    constructor(name: string, parent?: ComponentResource) {
        this.name = name;
        this.parent = parent;
    }

    withIndexRewrite() {
        this.handlerChain.push({
            name: "indexRewriteHandler",
        });
        return this;
    }

    withBasicAuth(username: string, password: string) {
        this.handlerChain.push(
            {
                name: "basicAuthHandler",
                replacements: {
                    "__BASIC_AUTH__": Buffer.from(`${username}:${password}`).toString('base64'),
                }
            }
        );
        return this;
    }

    build() {
        const func = createFunction(this.name, this.eventType, this.handlerChain, this.parent);
        return {
            eventType: this.eventType,
            functionArn: func.arn,
        };
    }
}

export class ViewerResponseFunction {
    private eventType: EventType = "viewer-response";
    private handlerChain: Handler[] = [];
    private name: string;
    private parent?: ComponentResource;

    constructor(name: string, parent?: ComponentResource) {
        this.name = name;
        this.parent = parent;
    }

    /**
     * Sets the cache-control header to control browser caching.
     * @param immutable if resources can be treated as immutable (will be cached by up to a year)
     */
    withCacheControl(immutable: boolean) {
        this.handlerChain.push({
            name: "cacheControlHandler",
            replacements: { "__IMMUTABLE__": `${immutable}` },
        });
        return this;
    }

    build() {
        const func = createFunction(this.name, this.eventType, this.handlerChain, this.parent);
        return {
            eventType: this.eventType,
            functionArn: func.arn,
        };
    }
}

export function loadHandlerCode(path: string, replacements: { [key: string]: string }) {
    let handlerCode = fs.readFileSync(path, "utf-8");
    Object.keys(replacements).forEach(key => {
        const value = replacements![key];
        handlerCode = handlerCode.replace(key, value);
    });
    return handlerCode;
}

export interface Handler {
    /**
     * The handler code. If omitted, will try to load a internal handler with the same 'name'.
     */
    readonly code?: pulumi.Input<string>;

    /**
     * Name of the handler function within the code.
     */
    readonly name: string;

    /**
     * String replacements to be performed on the handler code.
     */
    readonly replacements?: { [key: string]: string };
}

export type EventType = `viewer-request` | `viewer-response`;

/**
 * Creates a CloudFront function that processes the request/response through a chain of handlers.
 * The first handler that returns a non-null value wins, and no other handlers are executed.
 */
function createFunction(name: string, eventType: EventType, handlerChain: Handler[], parent?: ComponentResource) {
    const handlersDir = `${__dirname}/../../resources/cloudfront-function-handlers/${eventType}`;

    const handlerNames = handlerChain.map(handler => handler.name).join();
    let code = `const handlerChain = [${handlerNames}];

        async function handler(event) {
            const input = ${eventType == "viewer-request" ? "event.request" : "event.response"};
            for (let i = 0; i < handlerChain.length; i++) {
                const handler = handlerChain[i];
                const processed = await handler(input);
                if (processed != null) {
                    return processed;
                }
            }
            return input;
        }`;

    for (const handler of handlerChain) {
        const handlerCode = handler.code ?? loadHandlerCode(`${handlersDir}/${handler.name}.js`, handler.replacements ?? {});
        code += `\n\n// ----------- Handler: ${handler.name} -----------\n`;
        code += handlerCode;
    }

    return new aws.cloudfront.Function(name, {
        runtime: "cloudfront-js-2.0",
        comment: `${handlerNames}`,
        publish: true,
        code,
    }, {
        parent,
    });
}
