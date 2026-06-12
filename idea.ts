// © 2026 Oscar Knap - Alle rechten voorbehouden

import { orHandler, orApp, orRouter, orNext, orResponse, orFileSchema } from ".";
import type { orRouterReturn, orRouterRequirements, orAppReturn, orAppRequirements, LrResponse } from ".";
import { z } from 'zod';

const handler1 = orHandler('*', '/foo/*', {
    body: z.object({
        name: z.string(),
        foo: z.number()
    }),
    query: z.object({
        hi: z.string(),
    }),
    params: z.object({
        '*': z.string().transform(a => parseInt(a)),
    }),
    files: z.object({
        hi: orFileSchema,
        hi2: orFileSchema.transform(({ name, ...rest }) => ({ name: 'hi2', ...rest })),
    }),
    failResponse: async ({ bodyError, queryError, paramsError }, req) => {
        req.method;
        req.path;
        req.params;
        req.body;
        req.query;

        if (bodyError) {
            // return orNext;
        }

        return orResponse().status(400).json({ success: false } as const);
    }
}, async req => {
    req.method;
    req.path;
    req.params;
    req.body;
    req.query;

    if (Math.random() < 0.5) {
        return orNext;
    }

    return orResponse().status(200).text('Hello world');
});

const handler2 = orHandler('*', '/*', {
    body: z.object({
        foo: z.string()
    }),
    failResponse: () => orResponse()
}, async req => {
    // return orNext();
    // return orJson({ success: true });
    // return orStatus(500, orJson({ success: false }));
    // return orRedirect('/');
    return orResponse().status(500).json({ success: false } as const);
});

const router = orRouter('', [
    handler1,
    // handler2,
] as const);

type c = orRouterReturn<typeof router, 'GET', '/foo/hi'>;

const app = orApp(router, {
    errorResponse: orResponse().status(500).json({ success: false } as const),
    // errorResponseFunction: () => orResponse().status(123),
    noHandlerResponse: (req) => {
        req.method;
        req.path;
        req.params;
        req.body;
        req.query;

        return orResponse().status(404).json({ success: false } as const);
    },
    addResponseHeaders: (req, res) => ({
        foo: 'bar'
    } as const),
    addResponseCookies: (req, res) => ({
        foo: { value: 'bar' }
    } as const)
});

type a = orAppReturn<typeof app, 'GET', '/foo/hi'>;
type b = orAppRequirements<typeof app, 'GET', '/foo/hi'>;

// const server = app.createServer();