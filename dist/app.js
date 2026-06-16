// © 2026 Oscar Knap - Alle rechten voorbehouden
import { LrResponse } from "./response";
import { sendNodeResponse, transformNodeRequest } from "./node";
import { orNext } from "./handler";
import { LrRouter } from "./router";
import { createServer } from "node:http";
class LrApp {
    router;
    errorResponse;
    errorResponseFunction;
    noHandlerResponse;
    addResponseHeaders;
    addResponseCookies;
    constructor(router, errorResponse, noHandlerResponse, errorResponseFunction, addResponseHeaders, addResponseCookies) {
        if (!(router instanceof LrRouter)) {
            throw new Error(`router must be instanceof LrRouter, got typeof ${typeof router}`);
        }
        this.router = router;
        this.errorResponse = errorResponse;
        this.errorResponseFunction = errorResponseFunction;
        this.noHandlerResponse = noHandlerResponse;
        this.addResponseHeaders = addResponseHeaders;
        this.addResponseCookies = addResponseCookies;
    }
    async execute(req) {
        try {
            let response;
            try {
                const routerResponse = await this.router.execute(req);
                if (routerResponse === orNext) {
                    const noHandlerResponse = await this.noHandlerResponse(req);
                    if (!(noHandlerResponse instanceof LrResponse)) {
                        throw new Error(`noHandlerResponse must return LrResponse, got typeof ${typeof noHandlerResponse}`);
                    }
                    response = noHandlerResponse;
                }
                else {
                    if (!(routerResponse instanceof LrResponse)) {
                        throw new Error(`handler must return LrResponse, got typeof ${typeof routerResponse}`);
                    }
                    response = routerResponse;
                }
            }
            catch (e) {
                if (!this.errorResponseFunction) {
                    throw e;
                }
                const errorResponse = await this.errorResponseFunction(req, e);
                if (!(errorResponse instanceof LrResponse)) {
                    throw new Error(`errorResponseFunction must return LrResponse, got typeof ${typeof errorResponse}`);
                }
                response = errorResponse;
            }
            if (this.addResponseHeaders) {
                const headers = await this.addResponseHeaders(req, response);
                response = response.headers(headers);
            }
            if (this.addResponseCookies) {
                const cookies = await this.addResponseCookies(req, response);
                response = response.cookies(cookies);
            }
            return response.response;
        }
        catch (e) {
            console.warn('[oscar-router] Unhandled error in execute', e);
            return this.errorResponse.response;
        }
    }
    async nodeExecute(nodeReq, nodeRes) {
        let response;
        try {
            const req = await transformNodeRequest(nodeReq);
            response = await this.execute(req);
        }
        catch (e) {
            console.warn('[oscar-router] Unhandled error in nodeExecute', e);
            response = this.errorResponse.response;
        }
        try {
            await sendNodeResponse(nodeReq, nodeRes, response);
        }
        catch (e) {
            console.warn('[oscar-router] Unhandled error in sendNodeResponse', e);
            if (!nodeRes.headersSent) {
                try {
                    await sendNodeResponse(nodeReq, nodeRes, this.errorResponse.response);
                }
                catch (fallbackError) {
                    console.warn('[oscar-router] Unhandled error while sending fallback errorResponse', fallbackError);
                    nodeRes.destroy();
                }
            }
            else if (!nodeRes.writableEnded) {
                nodeRes.writeHead(500, 'Internal Server Error').end();
            }
        }
    }
    createServer() {
        const server = createServer({
            keepAlive: true,
            requestTimeout: 1000 * 20
        }, async (nodeReq, nodeRes) => {
            await this.nodeExecute(nodeReq, nodeRes);
        });
        return server;
    }
}
;
export function orApp(router, options) {
    if (typeof options !== 'object') {
        throw new Error(`options must be an object, received typeof ${typeof options}`);
    }
    return new LrApp(router, options.errorResponse, options.noHandlerResponse, options.errorResponseFunction, options.addResponseHeaders, options.addResponseCookies);
}
