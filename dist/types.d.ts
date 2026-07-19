import type z from "zod";
import type { LrHandler, orNext } from "./handler";
import type { LrRouter } from "./router";
import type { httpMethod } from "./response";
import type { file } from "./node";
export interface requestData {
}
export type orRequest<method extends httpMethod, path extends `/${string}`> = {
    method: method;
    isHead: method extends 'GET' ? boolean : false;
    path: path;
    url: `${path}${string}`;
    params: null;
    query: Record<string, string>;
    body: unknown;
    files: Record<string, file>;
    data: requestData;
    ip: string;
    headers: Record<string, string>;
    cookies: Record<string, string>;
};
export type orHandlerRequest<method extends httpMethod, path extends `/${string}`, params extends Record<string, any>, // any, because it can be transformed with zod
query extends Record<string, any>, // any, because it can be transformed with zod
files extends Record<string, any>, // any, because it can be transformed with zod
body> = {
    method: method;
    isHead: method extends 'GET' ? boolean : false;
    path: path;
    url: `${path}${string}`;
    params: params;
    query: query;
    body: body;
    files: files;
    data: requestData;
    ip: string;
    headers: Record<string, string>;
    cookies: Record<string, string>;
};
export type simplify<T> = T extends object ? {
    [K in keyof T]: T[K];
} : T;
export type simplifyRequirements<T> = T extends file ? unknown : T extends string | number | boolean | bigint | symbol ? T : (T extends object ? {
    [K in keyof T]: simplifyRequirements<T[K]>;
} : T);
type partMatchPaths<definitionPart extends string, testPart extends string> = definitionPart extends `:${string}` ? (testPart extends '' ? false : true) : definitionPart extends testPart ? true : false;
type matchPaths<definition extends string, test extends `/${string}`> = definition extends `/${infer definitionPart}/${infer definitionRest}` ? (test extends `/${infer testPart}/${infer testRest}` ? (definitionPart extends '*' ? never : partMatchPaths<definitionPart, testPart> extends true ? matchPaths<`/${definitionRest}`, `/${testRest}`> : false) : (definitionRest extends '*' ? (test extends `/${infer testPart}` ? partMatchPaths<definitionPart, testPart> : never) : definitionRest extends '' ? (test extends `/${infer testPart}` ? partMatchPaths<definitionPart, testPart> : never) : false)) : (definition extends `/${infer definitionPart}` ? (definitionPart extends '*' ? true : (test extends `/${infer testPart}/${infer testRest}` ? (testRest extends '' ? partMatchPaths<definitionPart, testPart> : false) : (test extends `/${infer testPart}` ? partMatchPaths<definitionPart, testPart> : never))) : (never));
type matchMethods<definitionMethods extends '*' | httpMethod | readonly httpMethod[], testMethod extends httpMethod> = definitionMethods extends '*' ? true : definitionMethods extends testMethod ? true : (definitionMethods extends readonly httpMethod[] ? testMethod extends definitionMethods[number] ? true : false : false);
export type matchRequest<methods extends '*' | httpMethod | readonly httpMethod[], path extends string, testMethod extends httpMethod, testPath extends `/${string}`> = matchMethods<methods, testMethod> extends true ? (matchPaths<path, testPath> extends true ? true : false) : false;
type pathDefinitionToTypeInternal<definitionPath extends string, withoutFirstSlash extends boolean = false> = definitionPath extends `/${infer part}/${infer rest}` ? (part extends '*' ? never : (part extends `:${string}` ? `${withoutFirstSlash extends true ? '' : '/'}${string}${pathDefinitionToTypeInternal<`/${rest}`>}` : `${withoutFirstSlash extends true ? '' : '/'}${part}${pathDefinitionToTypeInternal<`/${rest}`>}`)) : (definitionPath extends `/${infer part}` ? (part extends '*' ? `${withoutFirstSlash extends true ? '' : '/'}${string}` : `${withoutFirstSlash extends true ? '' : '/'}${part}`) : never);
export type pathDefinitionToType<definitionPath extends string> = `/${string}${pathDefinitionToTypeInternal<definitionPath, true>}`;
type pathDefinitionToParamNames<definitionPath extends string> = definitionPath extends `/${infer part}/${infer rest}` ? (part extends '*' ? never : (part extends `:${infer paramName}` ? ([paramName, ...pathDefinitionToParamNames<`/${rest}`>]) : pathDefinitionToParamNames<`/${rest}`>)) : (definitionPath extends `/${infer part}` ? (part extends '*' ? ['*'] : (part extends `:${infer paramName}` ? [paramName] : [])) : never);
export type pathDefinitionToParams<definitionPath extends string> = pathDefinitionToParamNames<definitionPath> extends never ? never : {
    [k in pathDefinitionToParamNames<definitionPath>[number]]: string;
};
export type methodsDefinitionToMethods<definitionMethods extends '*' | httpMethod | readonly httpMethod[]> = definitionMethods extends '*' ? httpMethod : definitionMethods extends httpMethod ? definitionMethods : definitionMethods[number];
export type canRouterCallNext<pathPrefix extends '' | `/${string}`, handlers extends readonly any[], // can't be typed better here
testMethod extends httpMethod, testPath extends `/${string}`> = handlers extends readonly [infer firstHandler, ...infer restHandlers] ? (firstHandler extends LrHandler<infer firstHandlerMethods, infer firstHandlerPath, infer firstHandlerValidations, infer firstHandlerCallback> ? (matchRequest<firstHandlerMethods, `${pathPrefix}${firstHandlerPath}`, testMethod, testPath> extends true ? ((typeof orNext) extends Awaited<ReturnType<firstHandlerCallback>> ? canRouterCallNext<pathPrefix, restHandlers, testMethod, testPath> : false) : (canRouterCallNext<pathPrefix, restHandlers, testMethod, testPath>)) : (firstHandler extends LrRouter<infer lastHandlerPathPrefix, infer lastHandlerHandlers> ? (canRouterCallNext<`${pathPrefix}${lastHandlerPathPrefix}`, lastHandlerHandlers, testMethod, testPath> extends true ? canRouterCallNext<pathPrefix, restHandlers, testMethod, testPath> : false) : never)) : true;
export type validationsToRequirements<validations extends any> = (validations extends {
    body: z.ZodType;
} ? {
    body: z.input<validations['body']>;
} : unknown) & (validations extends {
    query: z.ZodType;
} ? {
    query: z.input<validations['query']>;
} : unknown) & (validations extends {
    files: z.ZodType;
} ? {
    files: z.input<validations['files']>;
} : unknown);
export {};
//# sourceMappingURL=types.d.ts.map