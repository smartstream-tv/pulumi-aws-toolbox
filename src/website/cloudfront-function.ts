import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { ComponentResource } from "@pulumi/pulumi";
const fs = require("fs");

/**
 * Creates a CloudFront function that processes the request/response through a chain of handlers.
 * 
 * A handler may decide to stop processing following handlers and return it's result immediately.
 */
abstract class CloudfrontChainedFunction {
    private name: string;
    private eventType: EventType;
    private parent?: ComponentResource;
    protected handlerChain: Handler[];

    constructor(name: string, eventType: EventType, parent?: ComponentResource) {
        this.name = name;
        this.eventType = eventType;
        this.parent = parent;
        this.handlerChain = [];
    }

    customHandler(handler: Handler) {
        this.handlerChain.push(handler);
        return this;
    }

    build() {
        const func = this.createFunction();
        return {
            eventType: this.eventType,
            functionArn: func.arn,
        };
    }

    private createFunction() {
        const handlersDir = `${__dirname}/../../resources/cloudfront-function-handlers/${this.eventType}`;

        const handlerNames = this.handlerChain.map(handler => handler.name).join();
        let code = `const handlerChain = [${handlerNames}];

async function handler(event) {
    let input = ${this.eventType == "viewer-request" ? "event.request" : "event.response"};
    for (let i = 0; i < handlerChain.length; i++) {
        const handler = handlerChain[i];
        const processed = await handler(input);
        const outputEvent = ${this.eventType == "viewer-request" ? "processed.request" : "processed.response"};
        if (processed.stop) {
            return outputEvent;
        } else {
            input = outputEvent;
        }
    }
    return input;
}`;

        for (const handler of this.handlerChain) {
            const handlerCode = handler.code ?? loadHandlerCode(`${handlersDir}/${handler.name}.js`, handler.replacements ?? {});
            code += `\n\n// ----------- Handler: ${handler.name} -----------\n`;
            code += handlerCode;
        }

        return new aws.cloudfront.Function(this.name, {
            runtime: "cloudfront-js-2.0",
            comment: `${handlerNames}`,
            publish: true,
            code,
        }, {
            parent: this.parent,
        });
    }
}

export class ViewerRequestFunction extends CloudfrontChainedFunction {
    constructor(name: string, parent?: ComponentResource) {
        super(name, "viewer-request", parent);
    }

    /**
     * The handler appends index.html to requests that end with a slash or don’t include a file extension in the URL.
     */
    withIndexRewrite() {
        this.handlerChain.push({
            name: "indexRewriteHandler",
        });
        return this;
    }

    /**
     * Adds a HTTP basic auth check.
     * If the checks fails the processing is stopped.
     */
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
}

export class ViewerResponseFunction extends CloudfrontChainedFunction {
    constructor(name: string, parent?: ComponentResource) {
        super(name, "viewer-response", parent);
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

    /**
     * Adds several common security-related HTTP headers to the response, see the handler code for details.
     */
    withSecurityHeaders() {
        this.handlerChain.push({
            name: "securityHeadersHandler",
        });
        return this;
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
