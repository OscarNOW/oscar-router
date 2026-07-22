import type z from "zod";
import { type LrResponse, type orResponseObject, type httpMethod } from "./response";
import type { orHandlerRequest, orRequest, matchRequest, methodsDefinitionToMethods, pathDefinitionToParams, pathDefinitionToType } from "./types";
import type { file } from "./node";
export declare const orNext: "orNext" & {
    __orNext: symbol;
};
type pathParts = ({
    type: 'literal';
    value: string;
} | {
    type: 'param';
    name: string;
} | {
    type: 'rest';
})[];
export declare function pathToParts(path: string): pathParts;
export declare function match<const methods extends '*' | httpMethod | readonly httpMethod[], const path extends string, const testMethod extends httpMethod, const testPath extends `/${string}`>(methods: methods, path: path, testMethod: testMethod, testPath: testPath): matchRequest<methods, path, testMethod, testPath>;
type orHandlerReturn = LrResponse<orResponseObject> | typeof orNext;
export type orHandlerCallback<method extends httpMethod, path extends `/${string}`, params extends Record<string, any>, // any, because it can be transformed with zod
query extends Record<string, any>, // any, because it can be transformed with zod
files extends Record<string, any>, // any, because it can be transformed with zod
body extends any> = (req: orHandlerRequest<method, path, params, query, files, body>) => (orHandlerReturn | Promise<orHandlerReturn>);
export type generalValidations<methods extends '*' | httpMethod | readonly httpMethod[], path extends string> = null | {
    body?: z.ZodType;
    query?: z.ZodType<unknown, Record<string, string>>;
    params?: z.ZodType<unknown, pathDefinitionToParams<path>>;
    files?: z.ZodType<unknown, Record<string, file>>;
    failResponse: (errors: orValidationErrors, req: orRequest<methodsDefinitionToMethods<methods>, pathDefinitionToType<path>>) => LrResponse<orResponseObject> | Promise<LrResponse<orResponseObject>>;
};
export type orValidationErrors = {
    bodyError: z.ZodError | null;
    filesError: z.ZodError | null;
    queryError: z.ZodError | null;
    paramsError: z.ZodError | null;
};
export type orGeneralLrHandler = LrHandler<'*' | httpMethod | readonly httpMethod[], `/${string}`, generalValidations<'*' | httpMethod | readonly httpMethod[], `/${string}`>, orHandlerCallback<httpMethod, `/${string}`, Record<string, any>, Record<string, any>, Record<string, any>, unknown>>;
export declare class LrHandler<const methods extends '*' | httpMethod | readonly httpMethod[], const path extends string, const validations extends generalValidations<methods, path>, const callback extends orHandlerCallback<methodsDefinitionToMethods<methods>, pathDefinitionToType<path>, validations extends {
    params: any;
} ? z.output<validations['params']> : pathDefinitionToParams<path>, validations extends {
    query: any;
} ? z.output<validations['query']> : Record<string, string>, validations extends {
    files: any;
} ? z.output<validations['files']> : Record<string, file>, validations extends {
    body: any;
} ? z.output<validations['body']> : unknown>> {
    methods: methods;
    path: path;
    validations: validations;
    callback: callback;
    constructor(methods: methods, path: path, validations: validations, callback: callback);
    match<const testMethod extends httpMethod, const testPath extends `/${string}`>(method: testMethod, path: testPath): matchRequest<methods, path, testMethod, testPath>;
    execute(pathPrefix: string, req: orRequest<methodsDefinitionToMethods<methods>, pathDefinitionToType<path>>): Promise<Awaited<ReturnType<callback>> | (validations extends {
        failResponse: (...args: any[]) => infer returnFailResponse;
    } ? (Awaited<returnFailResponse>) : never)>;
}
export declare function orHandler<const methods extends '*' | httpMethod | readonly httpMethod[], const path extends `/${string}`, const validations extends generalValidations<methods, path>, const callback extends orHandlerCallback<methodsDefinitionToMethods<methods>, pathDefinitionToType<path>, validations extends {
    params: any;
} ? z.output<validations['params']> : pathDefinitionToParams<path>, validations extends {
    query: any;
} ? z.output<validations['query']> : Record<string, string>, validations extends {
    files: any;
} ? z.output<validations['files']> : Record<string, file>, validations extends {
    body: any;
} ? z.output<validations['body']> : unknown>>(methods: methods, path: path, validations: validations, callback: callback): LrHandler<methods, path, validations, callback>;
export {};
//# sourceMappingURL=handler.d.ts.map