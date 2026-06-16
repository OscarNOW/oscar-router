// © 2026 Oscar Knap - Alle rechten voorbehouden
import { orNext } from "./handler";
import { LrHandler } from "./handler";
import { LrResponse, } from "./response";
export class LrRouter {
    pathPrefix;
    handlers;
    constructor(pathPrefix, handlers) {
        if (typeof pathPrefix !== 'string') {
            throw new Error(`Invalid pathPrefix: ${pathPrefix}`);
        }
        if (pathPrefix !== '' && !pathPrefix.startsWith('/')) {
            throw new Error(`Invalid pathPrefix: ${pathPrefix}`);
        }
        if (!Array.isArray(handlers)) {
            throw new Error(`Invalid handlers: ${handlers}`);
        }
        for (const handler of handlers) {
            if (!(handler instanceof LrHandler) && !(handler instanceof LrRouter)) {
                throw new Error(`Invalid handler: ${handler}`);
            }
        }
        this.pathPrefix = pathPrefix;
        this.handlers = handlers;
    }
    match(method, path) {
        return this.#matchInternal('', method, path);
    }
    #matchInternal(previousPathPrefix, method, path) {
        const currentPathPrefix = `${previousPathPrefix}${this.pathPrefix}`;
        if (!path.startsWith(currentPathPrefix)) {
            return {
                type: 'router',
                router: this,
                matches: []
            };
        }
        let restPath = path.slice(currentPathPrefix.length);
        if (restPath === '')
            restPath = '/';
        if (!restPath.startsWith('/')) {
            return {
                type: 'router',
                router: this,
                matches: []
            };
        }
        let matches = [];
        for (const handler of this.handlers) {
            if (handler instanceof LrHandler) {
                const match = handler.match(method, restPath);
                if (match) {
                    matches.push({
                        type: 'handler',
                        handler
                    });
                }
            }
            else if (handler instanceof LrRouter) {
                const match = handler.#matchInternal(currentPathPrefix, method, path);
                if (match.matches.length > 0) {
                    matches.push(match);
                }
            }
        }
        return {
            type: 'router',
            router: this,
            matches
        };
    }
    async execute(req) {
        const match = this.match(req.method, req.path);
        const response = await this.#executeInternal('', match, req);
        if (response === orNext) {
            return orNext;
        }
        if (!(response instanceof LrResponse)) {
            throw new Error(`handler must return LrResponse, got typeof ${typeof response}`);
        }
        return response;
    }
    async #executeInternal(currentPathPrefix, match, req) {
        if (match.type === 'handler') {
            const response = await match.handler.execute(currentPathPrefix, req);
            if (response === orNext) {
                return orNext;
            }
            if (!(response instanceof LrResponse)) {
                throw new Error(`handler (${Array.isArray(match.handler.methods) ? match.handler.methods.join(', ') : match.handler.methods} ${match.handler.path}) must return LrResponse or orNext, got typeof ${typeof response}`);
            }
            return response;
        }
        else if (match.type === 'router') {
            currentPathPrefix = `${currentPathPrefix}${match.router.pathPrefix}`;
            for (const innerMatch of match.matches) {
                const response = await this.#executeInternal(currentPathPrefix, innerMatch, req);
                if (response === orNext) {
                    continue;
                }
                if (!(response instanceof LrResponse)) {
                    throw new Error(`handler must return LrResponse or orNext, got typeof ${typeof response}`);
                }
                return response;
            }
        }
        return orNext;
    }
}
;
export function orRouter(pathPrefix, handlers) {
    return new LrRouter(pathPrefix, handlers);
}
