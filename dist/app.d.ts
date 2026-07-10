import { LrResponse } from "./response";
import { orNext } from "./handler";
import { LrRouter } from "./router";
import type { canRouterCallNext, orRequest } from "./types";
import type { orResponseObject, responseCookieOptions, responseWithCookies, responseWithHeaders, httpMethod } from "./response";
import type { generalHandlerOrRouter, orRouterRequirements, orRouterReturn, orRouterRoutes } from "./router";
import { type IncomingMessage, type Server, type ServerResponse } from "node:http";
type generalErrorResponseFunction = (req: orRequest<httpMethod, `/${string}`>, error: unknown) => LrResponse<orResponseObject> | Promise<LrResponse<orResponseObject>>;
type noHandlerResponseFunction = (req: orRequest<httpMethod, `/${string}`>) => LrResponse<orResponseObject> | Promise<LrResponse<orResponseObject>>;
type generalAddResponseHeaders = (req: orRequest<httpMethod, `/${string}`>, res: LrResponse<orResponseObject>) => Record<string, string> | Promise<Record<string, string>>;
type generalAddResponseCookies = (req: orRequest<httpMethod, `/${string}`>, res: LrResponse<orResponseObject>) => Record<string, {
    value: string;
} & Partial<responseCookieOptions>> | Promise<Record<string, {
    value: string;
} & Partial<responseCookieOptions>>>;
declare class LrApp<pathPrefix extends '' | `/${string}`, handlers extends readonly generalHandlerOrRouter[], errorResponse extends LrResponse<orResponseObject>, noHandlerResponse extends noHandlerResponseFunction, errorResponseFunction extends generalErrorResponseFunction | undefined, addResponseHeaders extends generalAddResponseHeaders | undefined, addResponseCookies extends generalAddResponseCookies | undefined> {
    router: LrRouter<pathPrefix, handlers>;
    errorResponse: errorResponse;
    errorResponseFunction: errorResponseFunction;
    noHandlerResponse: noHandlerResponse;
    addResponseHeaders: addResponseHeaders;
    addResponseCookies: addResponseCookies;
    constructor(router: LrRouter<pathPrefix, handlers>, errorResponse: errorResponse, noHandlerResponse: noHandlerResponse, errorResponseFunction: errorResponseFunction, addResponseHeaders: addResponseHeaders, addResponseCookies: addResponseCookies);
    execute<testMethod extends httpMethod, testPath extends `/${string}`>(req: orRequest<testMethod, testPath>): Promise<orAppReturn<this, testMethod, testPath>>;
    nodeExecute(nodeReq: IncomingMessage, nodeRes: ServerResponse): Promise<void>;
    createServer(): Server;
}
type responseHeadersWrapper<addResponseHeaders extends generalAddResponseHeaders | undefined, response extends orResponseObject> = addResponseHeaders extends (req: any, res: any) => infer responseHeaders ? (Awaited<responseHeaders> extends Record<string, string> ? responseWithHeaders<response, Awaited<responseHeaders>> : response) : response;
type responseCookiesWrapper<addResponseCookies extends generalAddResponseCookies | undefined, response extends orResponseObject> = addResponseCookies extends (req: any, res: any) => infer responseCookies ? (Awaited<responseCookies> extends Record<string, {
    value: string;
} & Partial<responseCookieOptions>> ? responseWithCookies<response, Awaited<responseCookies>> : response) : response;
type responseWrapper<addResponseHeaders extends generalAddResponseHeaders | undefined, addResponseCookies extends generalAddResponseCookies | undefined, response extends LrResponse<orResponseObject>> = response extends LrResponse<infer responseObject> ? LrResponse<responseHeadersWrapper<addResponseHeaders, responseCookiesWrapper<addResponseCookies, responseObject>>> : never;
export type orAppReturn<app extends LrApp<'' | `/${string}`, readonly generalHandlerOrRouter[], LrResponse<orResponseObject>, noHandlerResponseFunction, generalErrorResponseFunction | undefined, generalAddResponseHeaders | undefined, generalAddResponseCookies | undefined>, testMethod extends httpMethod, testPath extends `/${string}`> = app extends LrApp<infer pathPrefix, infer handlers, infer errorResponse, infer noHandlerResponse, infer errorResponseFunction, infer addResponseHeaders, infer addResponseCookies> ? (responseWrapper<addResponseHeaders, addResponseCookies, Exclude<orRouterReturn<LrRouter<pathPrefix, handlers>, testMethod, testPath>, typeof orNext>>['response'] | responseWrapper<addResponseHeaders, addResponseCookies, (errorResponseFunction extends (...args: any[]) => infer returnErrorResponseFunction ? (Awaited<returnErrorResponseFunction> extends LrResponse<orResponseObject> ? Awaited<returnErrorResponseFunction> : never) : never)>['response'] | responseWrapper<addResponseHeaders, addResponseCookies, (canRouterCallNext<pathPrefix, handlers, testMethod, testPath> extends true ? Awaited<ReturnType<noHandlerResponse>> : never)>['response'] | errorResponse['response']) : never;
export type orAppRequirements<app extends LrApp<'' | `/${string}`, readonly generalHandlerOrRouter[], LrResponse<orResponseObject>, noHandlerResponseFunction, generalErrorResponseFunction | undefined, generalAddResponseHeaders | undefined, generalAddResponseCookies | undefined>, testMethod extends httpMethod, testPath extends `/${string}`> = orRouterRequirements<app['router'], testMethod, testPath>;
export type orAppRoutes<app extends LrApp<'' | `/${string}`, readonly generalHandlerOrRouter[], LrResponse<orResponseObject>, noHandlerResponseFunction, generalErrorResponseFunction | undefined, generalAddResponseHeaders | undefined, generalAddResponseCookies | undefined>> = orRouterRoutes<app['router']>;
export declare function orApp<pathPrefix extends '' | `/${string}`, handlers extends readonly generalHandlerOrRouter[], options extends {
    errorResponse: LrResponse<orResponseObject>;
    noHandlerResponse: noHandlerResponseFunction;
    errorResponseFunction?: generalErrorResponseFunction;
    addResponseHeaders?: generalAddResponseHeaders;
    addResponseCookies?: generalAddResponseCookies;
}>(router: LrRouter<pathPrefix, handlers>, options: options): LrApp<pathPrefix, handlers, options['errorResponse'], options['noHandlerResponse'], unknown extends options['errorResponseFunction'] ? undefined : options['errorResponseFunction'], unknown extends options['addResponseHeaders'] ? undefined : options['addResponseHeaders'], unknown extends options['addResponseCookies'] ? undefined : options['addResponseCookies']>;
export {};
//# sourceMappingURL=app.d.ts.map