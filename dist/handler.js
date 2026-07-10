// © 2026 Oscar Knap - Alle rechten voorbehouden
import { httpMethods } from "./response";
// typescript sometimes converts the Symbol('orNext') to symbol, so we just convert it to a special object
export const orNext = Symbol('orNext');
export function pathToParts(path) {
    if (typeof path !== 'string') {
        throw new Error(`Path must be a string, got ${path} (${typeof path})`);
    }
    if (!path.startsWith('/')) {
        throw new Error(`Path must start with /, got ${path}`);
    }
    let parts = [];
    for (const stringI in path.slice(1).split('/')) {
        const i = parseInt(stringI);
        const part = path.slice(1).split('/')[i];
        const isLast = i === path.slice(1).split('/').length - 1;
        if (part === '*') {
            if (!isLast) {
                throw new Error('* path part must be last');
            }
            if (parts.find(part => part.type === 'rest')) {
                throw new Error('rest part already exists');
            }
            parts.push({
                type: 'rest',
            });
        }
        else if (part.startsWith(':')) {
            const name = part.slice(1);
            if (parts.find(part => part.type === 'param' && part.name === name)) {
                throw new Error(`Param ${name} already exists`);
            }
            if (name.trim().length === 0) {
                throw new Error('Param name cannot be empty');
            }
            if (name === 'rest') {
                throw new Error('Param name cannot be rest');
            }
            if (name === '__proto__')
                throw new Error('Param name cannot be __proto__');
            if (name === 'prototype')
                throw new Error('Param name cannot be prototype');
            if (name === 'constructor')
                throw new Error('Param name cannot be constructor');
            parts.push({
                type: 'param',
                name,
            });
        }
        else {
            parts.push({
                type: 'literal',
                value: part,
            });
        }
    }
    return parts;
}
export function match(methods, path, testMethod, testPath) {
    let methodMatches = false;
    if (methods === '*')
        methodMatches = true;
    else if (typeof methods === 'string')
        methodMatches = methods === testMethod;
    else
        methodMatches = methods.includes(testMethod);
    if (!methodMatches)
        return false;
    if (!testPath.startsWith('/')) {
        throw new Error(`Request path must start with /, got ${testPath}`);
    }
    const reqPathSplit = testPath.slice(1).split('/');
    const pathParts = pathToParts(path);
    // +1 because /abc should match /abc/*
    if ((reqPathSplit.length + 1) < pathParts.length)
        return false;
    let hasRest = false;
    for (const stringI in pathParts) {
        const i = parseInt(stringI);
        const pathPart = pathParts[i];
        const reqPart = reqPathSplit[i];
        if (pathPart.type === 'literal') {
            if (reqPart === undefined)
                return false;
            if (pathPart.value !== reqPart)
                return false;
        }
        if (pathPart.type === 'param') {
            if (reqPart === undefined)
                return false;
            if (reqPart === '')
                return false;
            continue;
        }
        if (pathPart.type === 'rest') {
            hasRest = true;
            break;
        }
    }
    if (reqPathSplit.length > pathParts.length) {
        if (hasRest) {
            return true;
        }
        else {
            return false;
        }
    }
    return true;
}
function parseParams(pathPrefix, path, reqPath) {
    if (!reqPath.startsWith(pathPrefix)) {
        throw new Error(`parseParams got reqPath ${reqPath} that doesn't start with pathPrefix ${pathPrefix}`);
    }
    let restPath = reqPath.slice(pathPrefix.length);
    if (restPath === '')
        restPath = '/';
    if (!restPath.startsWith('/')) {
        throw new Error(`parseParams has restPath ${restPath} that doesn't start with /`);
    }
    const parts = pathToParts(path);
    let restPathParts = restPath.slice(1).split('/');
    // because /abc should match /abc/*
    if (parts[parts.length - 1]?.type === 'rest' &&
        restPathParts.length + 1 === parts.length) {
        restPathParts.push('');
    }
    if (restPathParts.length < parts.length) {
        throw new Error(`parseParams has restPathParts ${restPathParts} that are less than parts ${parts}`);
    }
    let params = Object.create(null);
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const restPart = restPathParts[i];
        if (part.type === 'param') {
            if (part.name === '__proto__')
                throw new Error('Param name cannot be __proto__');
            if (part.name === 'prototype')
                throw new Error('Param name cannot be prototype');
            if (part.name === 'constructor')
                throw new Error('Param name cannot be constructor');
            if (!restPart)
                throw new Error(`Param ${part.name} is missing`);
            params[part.name] = restPart;
        }
        else if (part.type === 'rest') {
            params['*'] = restPathParts.slice(i).join('/');
        }
    }
    return params;
}
export class LrHandler {
    methods;
    path;
    validations;
    callback;
    pathParts;
    constructor(methods, path, validations, callback) {
        if (methods === '*') { }
        else if (Array.isArray(methods) && methods.every(method => httpMethods.includes(method))) { }
        else if (typeof methods === 'string' && httpMethods.includes(methods)) { }
        else {
            throw new Error(`Invalid methods: ${methods}`);
        }
        this.pathParts = pathToParts(path);
        if (validations !== null) {
            if (typeof validations !== 'object') {
                throw new Error(`Invalid validations: ${validations}`);
            }
            if (typeof validations.failResponse !== 'function') {
                throw new Error(`Invalid validations.failResponse: ${validations.failResponse}`);
            }
        }
        if (typeof callback !== 'function') {
            throw new Error(`Invalid callback: ${callback}`);
        }
        this.methods = methods;
        this.path = path;
        this.validations = validations;
        this.callback = callback;
    }
    match(method, path) {
        return match(this.methods, this.path, method, path);
    }
    async execute(pathPrefix, req) {
        let newReq = { ...req };
        newReq.params = parseParams(pathPrefix, this.path, newReq.path);
        if (this.validations) {
            let bodyError = null;
            let filesError = null;
            let queryError = null;
            let paramsError = null;
            if (this.validations.body) {
                const bodyResult = await this.validations.body.safeParseAsync(newReq.body);
                if (!bodyResult.success) {
                    bodyError = bodyResult.error;
                }
                else {
                    newReq.body = bodyResult.data;
                }
            }
            if (this.validations.files) {
                const filesResult = await this.validations.files.safeParseAsync(newReq.files);
                if (!filesResult.success) {
                    filesError = filesResult.error;
                }
                else {
                    newReq.files = filesResult.data;
                }
            }
            if (this.validations.query) {
                const queryResult = await this.validations.query.safeParseAsync(newReq.query);
                if (!queryResult.success) {
                    queryError = queryResult.error;
                }
                else {
                    newReq.query = queryResult.data;
                }
            }
            if (this.validations.params) {
                const paramsResult = await this.validations.params.safeParseAsync(newReq.params);
                if (!paramsResult.success) {
                    paramsError = paramsResult.error;
                }
                else {
                    newReq.params = paramsResult.data;
                }
            }
            if (bodyError || filesError || queryError || paramsError) {
                const response = await this.validations.failResponse({ bodyError, filesError, queryError, paramsError }, req);
                return response;
            }
        }
        const response = await this.callback(newReq);
        return response;
    }
}
;
export function orHandler(methods, path, validations, callback) {
    return new LrHandler(methods, path, validations, callback);
}
