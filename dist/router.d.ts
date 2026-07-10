import type { generalValidations, orHandlerCallback } from "./handler";
import type { canRouterCallNext, orRequest, matchRequest, simplifyRequirements, validationsToRequirements } from "./types";
import type { httpMethod } from "./response";
import { orNext } from "./handler";
import { LrHandler } from "./handler";
export type orGeneralRouterMatch = {
    type: 'router';
    router: LrRouter<'' | `/${string}`, readonly generalHandlerOrRouter[]>;
    matches: orGeneralRouterMatchReturn[];
};
export type orGeneralHandlerMatch = {
    type: 'handler';
    handler: LrHandler<'*' | httpMethod | readonly httpMethod[], `/${string}`, generalValidations<'*' | httpMethod | readonly httpMethod[], `/${string}`>, orHandlerCallback<httpMethod, `/${string}`, Record<string, any>, Record<string, any>, Record<string, any>, unknown>>;
};
export type orGeneralRouterMatchReturn = orGeneralHandlerMatch | orGeneralRouterMatch;
type routerMatchReturnInternal<pathPrefix extends '' | `/${string}`, handlers extends readonly any[], // can't be typed better here
testMethod extends httpMethod, testPath extends `/${string}`> = handlers extends readonly [infer firstHandler, ...infer restHandlers] ? (firstHandler extends LrHandler<infer firstHandlerMethods, infer firstHandlerPath, infer firstHandlerValidations, infer firstHandlerCallback> ? (matchRequest<firstHandlerMethods, `${pathPrefix}${firstHandlerPath}`, testMethod, testPath> extends true ? ([
    {
        type: 'handler';
        handler: LrHandler<firstHandlerMethods, firstHandlerPath, firstHandlerValidations, firstHandlerCallback>;
    },
    ...routerMatchReturnInternal<pathPrefix, restHandlers, testMethod, testPath>
]) : (routerMatchReturnInternal<pathPrefix, restHandlers, testMethod, testPath>)) : (firstHandler extends LrRouter<infer firstHandlerPathPrefix, infer firstHandlerHandlers> ? (routerMatchReturnInternal<`${pathPrefix}${firstHandlerPathPrefix}`, firstHandlerHandlers, testMethod, testPath> extends readonly [...infer firstElements, infer lastElement] ? ([
    {
        type: 'router';
        router: LrRouter<firstHandlerPathPrefix, firstHandlerHandlers>;
        matches: [...firstElements, lastElement];
    },
    ...routerMatchReturnInternal<pathPrefix, restHandlers, testMethod, testPath>
]) : [...routerMatchReturnInternal<pathPrefix, restHandlers, testMethod, testPath>]) : never)) : [];
type routerMatchReturn<pathPrefix extends '' | `/${string}`, handlers extends readonly generalHandlerOrRouter[], testMethod extends httpMethod, testPath extends `/${string}`> = {
    type: 'router';
    router: LrRouter<pathPrefix, handlers>;
    matches: routerMatchReturnInternal<pathPrefix, handlers, testMethod, testPath>;
};
export type generalHandlerOrRouter = LrHandler<any, any, any, any> | LrRouter<any, any>;
export declare class LrRouter<pathPrefix extends '' | `/${string}`, handlers extends readonly generalHandlerOrRouter[]> {
    #private;
    pathPrefix: pathPrefix;
    handlers: handlers;
    constructor(pathPrefix: pathPrefix, handlers: handlers);
    match<testMethod extends httpMethod, testPath extends `/${string}`>(method: testMethod, path: testPath): routerMatchReturn<pathPrefix, handlers, testMethod, testPath>;
    execute<testMethod extends httpMethod, testPath extends `/${string}`>(req: orRequest<testMethod, testPath>): Promise<orRouterReturn<this, testMethod, testPath>>;
}
type routerReturnInternal<pathPrefix extends '' | `/${string}`, handlers extends readonly any[], // can't be typed better here
testMethod extends httpMethod, testPath extends `/${string}`> = handlers extends readonly [infer firstHandler, ...infer restHandlers] ? (firstHandler extends LrHandler<infer firstHandlerMethods, infer firstHandlerPath, infer firstHandlerValidations, infer firstHandlerCallback> ? (matchRequest<firstHandlerMethods, `${pathPrefix}${firstHandlerPath}`, testMethod, testPath> extends true ? (Exclude<Awaited<ReturnType<firstHandlerCallback>>, typeof orNext> | (firstHandlerValidations extends {
    failResponse: (...args: any[]) => infer returnFailResponse;
} ? (Awaited<returnFailResponse>) : never) | ((typeof orNext) extends Awaited<ReturnType<firstHandlerCallback>> ? (routerReturnInternal<pathPrefix, restHandlers, testMethod, testPath>) : never)) : routerReturnInternal<pathPrefix, restHandlers, testMethod, testPath>) : (firstHandler extends LrRouter<infer firstHandlerPathPrefix, infer firstHandlerHandlers> ? (routerReturnInternal<`${pathPrefix}${firstHandlerPathPrefix}`, firstHandlerHandlers, testMethod, testPath> | (canRouterCallNext<`${pathPrefix}${firstHandlerPathPrefix}`, firstHandlerHandlers, testMethod, testPath> extends true ? (routerReturnInternal<pathPrefix, restHandlers, testMethod, testPath>) : never)) : never)) : (never);
export type orRouterReturn<router extends LrRouter<'' | `/${string}`, readonly generalHandlerOrRouter[]>, testMethod extends httpMethod, testPath extends `/${string}`> = router extends LrRouter<infer pathPrefix, infer handlers> ? (routerReturnInternal<pathPrefix, handlers, testMethod, testPath> | (canRouterCallNext<pathPrefix, handlers, testMethod, testPath> extends true ? typeof orNext : never)) : never;
type routerRequirementsInternal<pathPrefix extends '' | `/${string}`, handlers extends readonly any[], // can't be typed better here
testMethod extends httpMethod, testPath extends `/${string}`> = handlers extends readonly [infer firstHandler, ...infer restHandlers] ? (firstHandler extends LrHandler<infer firstHandlerMethods, infer firstHandlerPath, infer firstHandlerValidations, infer firstHandlerCallback> ? (matchRequest<firstHandlerMethods, `${pathPrefix}${firstHandlerPath}`, testMethod, testPath> extends true ? (validationsToRequirements<firstHandlerValidations> & ((typeof orNext) extends Awaited<ReturnType<firstHandlerCallback>> ? (routerRequirementsInternal<pathPrefix, restHandlers, testMethod, testPath>) : unknown)) : routerRequirementsInternal<pathPrefix, restHandlers, testMethod, testPath>) : (firstHandler extends LrRouter<infer firstHandlerPathPrefix, infer firstHandlerHandlers> ? (routerRequirementsInternal<`${pathPrefix}${firstHandlerPathPrefix}`, firstHandlerHandlers, testMethod, testPath> & (canRouterCallNext<`${pathPrefix}${firstHandlerPathPrefix}`, firstHandlerHandlers, testMethod, testPath> extends true ? (routerRequirementsInternal<pathPrefix, restHandlers, testMethod, testPath>) : unknown)) : never)) : ({
    body: {};
    query: {};
    files: {};
});
export type orRouterRequirements<router extends LrRouter<'' | `/${string}`, readonly generalHandlerOrRouter[]>, testMethod extends httpMethod, testPath extends `/${string}`> = router extends LrRouter<infer pathPrefix, infer handlers> ? (simplifyRequirements<routerRequirementsInternal<pathPrefix, handlers, testMethod, testPath>>) : never;
type routerHandlerRoute<pathPrefix extends '' | `/${string}`, handler extends generalHandlerOrRouter> = handler extends LrHandler<infer methods, infer path, any, any> ? ([
    methods,
    `${pathPrefix}${path}`
]) : handler extends LrRouter<infer routerPathPrefix, infer routerHandlers> ? (routerRoutesInternal<`${pathPrefix}${routerPathPrefix}`, routerHandlers>) : never;
type routerRoutesInternal<pathPrefix extends '' | `/${string}`, handlers extends readonly any[]> = routerHandlerRoute<`${pathPrefix}`, handlers[number]>;
export type orRouterRoutes<router extends LrRouter<'' | `/${string}`, readonly generalHandlerOrRouter[]>> = router extends LrRouter<infer pathPrefix, infer handlers> ? (routerRoutesInternal<pathPrefix, handlers>) : never;
export declare function orRouter<pathPrefix extends '' | `/${string}`, handlers extends readonly generalHandlerOrRouter[]>(pathPrefix: pathPrefix, handlers: handlers): LrRouter<pathPrefix, handlers>;
export {};
//# sourceMappingURL=router.d.ts.map