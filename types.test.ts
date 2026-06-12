// © 2026 Oscar Knap - Alle rechten voorbehouden

import { describe, test } from "bun:test";
import { expectTypeOf } from "expect-type";
import { z } from "zod";
import {
    orRouter, orHandler, orResponse, orNext,
    orApp, orFileSchema,
    type httpMethod, type orRequest, type LrResponse,
    type orHandlerRequest,
    type orRouterReturn, type orAppReturn,
    type orRouterRequirements,
    type orResponseObject,
} from ".";
import type { orAppRequirements } from "./app";
import type { file } from "./node";

// ─── Basic type tests ───

test("httpMethod is a union of standard HTTP methods", () => {
    expectTypeOf<httpMethod>().toEqualTypeOf<"GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS">();
});

test("orRequest shape with method and path", () => {
    type Req = orRequest<"GET", "/test">;
    expectTypeOf<Req>().toExtend<{ method: "GET"; path: "/test" }>();
    expectTypeOf<Req>().not.toExtend<{ method: "POST" }>();
});

test("orHandlerRequest shape with params, query and body", () => {
    type Req = orHandlerRequest<"POST", "/foo", { id: string }, { q: string }, { f: file }, { name: string }>;
    expectTypeOf<Req>().toExtend<{
        method: "POST";
        path: "/foo";
        files: { f: file };
        params: { id: string };
        query: { q: string };
        body: { name: string };
    }>();
});

// ─── orResponse builder ───

test("orResponse builder returns LrResponse", () => {
    const res = orResponse();
    type _check = typeof res extends LrResponse<any> ? true : false;
    const _v: _check = true;
});

// ─── Handler return type inference ───

test("handler returning orNext only", () => {
    const h = orHandler("GET", "/pass", null, () => orNext);
    type Ret = ReturnType<typeof h.callback>;
    type _isLrNext = Ret extends typeof orNext ? true : false;
    type _isResponse = Ret extends LrResponse<any> ? true : false;
    const _a: _isLrNext = true;
    const _b: _isResponse = false;
});

test("handler returning LrResponse only", () => {
    const h = orHandler("GET", "/ok", null, () => {
        return orResponse().status(200).text("ok");
    });
    type Ret = ReturnType<typeof h.callback>;
    type _isLrNext = Ret extends typeof orNext ? true : false;
    type _isResponse = Ret extends LrResponse<any> ? true : false;
    const _a: _isLrNext = false;
    const _b: _isResponse = true;
});

test("handler can return both orNext and LrResponse", () => {
    const h = orHandler("GET", "/maybe", null, () => {
        return Math.random() > 0.5 ? orNext : orResponse().status(200).text("ok");
    });
    type Ret = ReturnType<typeof h.callback>;
    type _isLrNext = typeof orNext extends Ret ? true : false;
    type _isResponse = LrResponse<any> extends Ret ? true : false;
    const _a: _isLrNext = true;
    const _b: _isResponse = true;
});

// ─── Router return type: basic ───

test("router with non-matching method returns orNext", () => {
    const router = orRouter("", [
        orHandler("GET", "/only-get", null, () => {
            return orResponse().status(200).text("get");
        }),
    ] as const);
    type Ret = orRouterReturn<typeof router, "POST", "/only-get">;
    type _isLrNext = Ret extends typeof orNext ? true : false;
    const _v: _isLrNext = true;
});

test("router with matching handler returns LrResponse", () => {
    const router = orRouter("", [
        orHandler("GET", "/hello", null, () => {
            return orResponse().status(200).json({ message: "hello" } as const);
        }),
    ] as const);
    type Ret = orRouterReturn<typeof router, "GET", "/hello">;
    type _isLrNext = Ret extends typeof orNext ? true : false;
    const _a: _isLrNext = false;
    type _isResponse = Ret extends LrResponse<any> ? true : false;
    const _b: _isResponse = true;
});

// ─── Edge case: nested router prefix consumes full path ───

const edgeRouter = orRouter("", [
    orRouter("/foo", [
        orHandler("GET", "/:id", null, () => {
            return orResponse().json({ reached: true } as const);
        }),
    ] as const),
] as const);

test("nested prefix /foo consumes full path -> empty :id, no match", () => {
    type Ret = orRouterReturn<typeof edgeRouter, "GET", "/foo">;
    type _isLrNext = Ret extends typeof orNext ? true : false;
    const _v: _isLrNext = true;
});

test("nested prefix /foo with extra path /foo/bar matches :id", () => {
    type Ret = orRouterReturn<typeof edgeRouter, "GET", "/foo/bar">;
    type _isLrNext = Ret extends typeof orNext ? true : false;
    const _a: _isLrNext = false;
    type _isResponse = Ret extends LrResponse<any> ? true : false;
    const _b: _isResponse = true;
});

// ─── Edge case: root param with empty path vs value ───

const rootParamRouter = orRouter("", [
    orHandler("GET", "/:id", null, () => {
        return orResponse().json({ reached: true } as const);
    }),
] as const);

test("root param /:id does NOT match path /", () => {
    type Ret = orRouterReturn<typeof rootParamRouter, "GET", "/">;
    type _isLrNext = Ret extends typeof orNext ? true : false;
    const _v: _isLrNext = true;
});

test("root param /:id matches path /hello", () => {
    type Ret = orRouterReturn<typeof rootParamRouter, "GET", "/hello">;
    type _isLrNext = Ret extends typeof orNext ? true : false;
    const _a: _isLrNext = false;
    type _isResponse = Ret extends LrResponse<any> ? true : false;
    const _b: _isResponse = true;
});

// ─── Edge case: deep nesting ───

const deepEdgeRouter = orRouter("", [
    orRouter("/a", [
        orRouter("/b", [
            orHandler("GET", "/:id", null, () => {
                return orResponse().json({ reached: true } as const);
            }),
        ] as const),
    ] as const),
] as const);

test("deep nested prefix /a/b consumes full path, no match", () => {
    type Ret = orRouterReturn<typeof deepEdgeRouter, "GET", "/a/b">;
    type _isLrNext = Ret extends typeof orNext ? true : false;
    const _v: _isLrNext = true;
});

test("deep nested path /a/b/c matches :id", () => {
    type Ret = orRouterReturn<typeof deepEdgeRouter, "GET", "/a/b/c">;
    type _isLrNext = Ret extends typeof orNext ? true : false;
    const _a: _isLrNext = false;
    type _isResponse = Ret extends LrResponse<any> ? true : false;
    const _b: _isResponse = true;
});

// ─── orApp return type ───

test("orApp with no match returns noHandlerResponse", () => {
    const router = orRouter("", [
        orHandler("GET", "/exists", null, () => {
            return orResponse().status(200).text("here");
        }),
    ] as const);

    const app = orApp(router, {
        errorResponse: orResponse().status(500).json({ error: true } as const),
        noHandlerResponse: () => orResponse().status(404).json({ not: "found" } as const),
    });

    type AppRet = orAppReturn<typeof app, "GET", "/nope">;
    type _isLrNext = AppRet extends typeof orNext ? true : false;
    const _v: _isLrNext = false;
});

// ─── orRequest isHead property ───

test("orRequest GET has isHead as boolean", () => {
    type Req = orRequest<"GET", "/test">;
    expectTypeOf<Pick<Req, "isHead">>().toEqualTypeOf<{ isHead: boolean }>();
});

test("orRequest non-GET has isHead as false", () => {
    type Req = orRequest<"POST", "/test">;
    expectTypeOf<Pick<Req, "isHead">>().toEqualTypeOf<{ isHead: false }>();
});

// ─── orResponse type inference ───

test("orResponse.json sets Content-Type and body type", () => {
    const res = orResponse().json({ message: "hello" } as const);
    type BodyType = typeof res extends LrResponse<infer R> ? R["body"] : never;
    type _isJson = BodyType extends { type: "json"; body: { message: "hello" } } ? true : false;
    const _v: _isJson = true;
});

test("orResponse.text sets Content-Type and body type", () => {
    const res = orResponse().status(201).text("created");
    type BodyType = typeof res extends LrResponse<infer R> ? R["body"] : never;
    type _isText = BodyType extends { type: "text"; body: "created" } ? true : false;
    const _v: _isText = true;
    type StatusType = typeof res extends LrResponse<infer R> ? R["status"] : never;
    type _is201 = StatusType extends 201 ? true : false;
    const _b: _is201 = true;
});

test("orResponse.html sets Content-Type to text/html", () => {
    const res = orResponse().html("<h1>hello</h1>");
    type Headers = typeof res extends LrResponse<infer R> ? R["headers"] : never;
    type _isHtml = Headers extends { "Content-Type": "text/html; charset=utf-8" } ? true : false;
    const _v: _isHtml = true;
});

test("orResponse.status changes status type", () => {
    const res = orResponse().status(404);
    type Status = typeof res extends LrResponse<infer R> ? R["status"] : never;
    type _is404 = Status extends 404 ? true : false;
    const _v: _is404 = true;
});

test("orResponse.header adds to headers type", () => {
    const res = orResponse().header("X-Custom", "value");
    type Headers = typeof res extends LrResponse<infer R> ? R["headers"] : never;
    type _hasCustom = Headers extends { "X-Custom": "value" } ? true : false;
    const _v: _hasCustom = true;
});

test("orResponse.redirect sets status 307 and Location header", () => {
    const res = orResponse().redirect("/next");
    type Status = typeof res extends LrResponse<infer R> ? R["status"] : never;
    type _is307 = Status extends 307 ? true : false;
    const _a: _is307 = true;
    type Headers = typeof res extends LrResponse<infer R> ? R["headers"] : never;
    type _hasLocation = Headers extends { Location: "/next" } ? true : false;
    const _b: _hasLocation = true;
});

test("orResponse.permanentRedirect sets status 308 and Location header", () => {
    const res = orResponse().permanentRedirect("/forever");
    type Status = typeof res extends LrResponse<infer R> ? R["status"] : never;
    type _is308 = Status extends 308 ? true : false;
    const _a: _is308 = true;
    type Headers = typeof res extends LrResponse<infer R> ? R["headers"] : never;
    type _hasLocation = Headers extends { Location: "/forever" } ? true : false;
    const _b: _hasLocation = true;
});

test("orResponse.buffer sets Content-Type octet-stream", () => {
    const res = orResponse().type("application/octet-stream").buffer(Buffer.from("abc"));
    type Headers = typeof res extends LrResponse<infer R> ? R["headers"] : never;
    type _isOctet = Headers extends { "Content-Type": "application/octet-stream" } ? true : false;
    const _v: _isOctet = true;
});

test("orResponse.type overrides Content-Type", () => {
    const res = orResponse().type("application/xml");
    type Headers = typeof res extends LrResponse<infer R> ? R["headers"] : never;
    type _isXml = Headers extends { "Content-Type": "application/xml" } ? true : false;
    const _v: _isXml = true;
});

// ─── Router return type: wildcard method ───

test("router with wildcard method matches any method", () => {
    const router = orRouter("", [
        orHandler("*", "/wild", null, () => {
            return orResponse().status(200).text("wild");
        }),
    ] as const);
    type RetGet = orRouterReturn<typeof router, "GET", "/wild">;
    type _isResponse = RetGet extends LrResponse<any> ? true : false;
    const _a: _isResponse = true;
    type RetPost = orRouterReturn<typeof router, "POST", "/wild">;
    type _isResponsePost = RetPost extends LrResponse<any> ? true : false;
    const _b: _isResponsePost = true;
});

// ─── Router return type: rest route ───

const restRouter = orRouter("", [
    orHandler("GET", "/files/*", null, () => {
        return orResponse().json({ type: "rest" } as const);
    }),
] as const);

test("rest route matches extra path segments", () => {
    type Ret = orRouterReturn<typeof restRouter, "GET", "/files/a/b">;
    type _isResponse = Ret extends LrResponse<any> ? true : false;
    const _v: _isResponse = true;
});

test("rest route matches path with zero extra segments", () => {
    type Ret = orRouterReturn<typeof restRouter, "GET", "/files">;
    type _isResponse = Ret extends LrResponse<any> ? true : false;
    const _v: _isResponse = true;
});

// ─── Router return type: fallthrough ───

const fallthroughRouter = orRouter("", [
    orHandler("GET", "/chain", null, () => orNext),
    orHandler("GET", "/chain", null, () => {
        return orResponse().json({ second: true } as const);
    }),
] as const);

test("router fallthrough: first handler returns orNext, second returns response", () => {
    type Ret = orRouterReturn<typeof fallthroughRouter, "GET", "/chain">;
    type _isResponse = Ret extends LrResponse<any> ? true : false;
    const _v: _isResponse = true;
});

// ─── Router return type: non-matching path after method match ───

test("router with matching method but non-matching path returns orNext", () => {
    const router = orRouter("", [
        orHandler("GET", "/only-this", null, () => {
            return orResponse().status(200).text("here");
        }),
    ] as const);
    type Ret = orRouterReturn<typeof router, "GET", "/other">;
    type _isLrNext = Ret extends typeof orNext ? true : false;
    const _v: _isLrNext = true;
});

// ─── Router return type: multiple handlers on different routes ───

test("router with multiple handlers on different paths resolves correctly", () => {
    const router = orRouter("", [
        orHandler("GET", "/a", null, () => orResponse().text("a")),
        orHandler("GET", "/b", null, () => orResponse().text("b")),
    ] as const);
    type RetA = orRouterReturn<typeof router, "GET", "/a">;
    type _isResponseA = RetA extends LrResponse<any> ? true : false;
    const _a: _isResponseA = true;
    type RetB = orRouterReturn<typeof router, "GET", "/b">;
    type _isResponseB = RetB extends LrResponse<any> ? true : false;
    const _b: _isResponseB = true;
});

// ─── Router return type: non-empty top-level prefix ───

const prefixedRouter = orRouter("/api", [
    orHandler("GET", "/status", null, () => {
        return orResponse().json({ ok: true } as const);
    }),
] as const);

test("top-level router with /api prefix matches full path /api/status", () => {
    type Ret = orRouterReturn<typeof prefixedRouter, "GET", "/api/status">;
    type _isResponse = Ret extends LrResponse<any> ? true : false;
    const _v: _isResponse = true;
});

const showsRouter = orRouter("/shows", [
    orHandler("GET", "/", null, () => {
        return orResponse().json({ ok: true } as const);
    }),
] as const);

test("top-level router /shows with root handler matches path /shows", () => {
    type Ret = orRouterReturn<typeof showsRouter, "GET", "/shows">;
    type _isResponse = Ret extends LrResponse<any> ? true : false;
    const _v: _isResponse = true;
});

const tripleCookiesHandler = orHandler("GET", "/", {
    query: z.object({ session: z.string() }),
    failResponse: () => orResponse().status(400).text("fail"),
}, () => {
    return orResponse().json({ cookies: true } as const);
});

const tripleCookiesRouter = orRouter("/cookies", [
    tripleCookiesHandler,
] as const);

const tripleCookiesMiddleRouter = orRouter("", [
    tripleCookiesRouter,
] as const);

const tripleCookiesRootRouter = orRouter("", [
    tripleCookiesMiddleRouter,
] as const);

test("router -> router -> router /cookies -> handler GET / return type matches /cookies", () => {
    type Ret = orRouterReturn<typeof tripleCookiesRootRouter, "GET", "/cookies">;
    type _isResponse = Ret extends LrResponse<any> ? true : false;
    const _a: _isResponse = true;
    type _isLrNext = typeof orNext extends Ret ? true : false;
    const _b: _isLrNext = false;
});

test("router -> router -> router /cookies -> handler GET / requirements match /cookies", () => {
    type Reqs = orRouterRequirements<typeof tripleCookiesRootRouter, "GET", "/cookies">;
    type _hasSessionQuery = Reqs extends { query: { session: string } } ? true : false;
    const _v: _hasSessionQuery = true;
});

test("router -> router -> router /cookies -> handler GET / match type nests routers", () => {
    const match = tripleCookiesRootRouter.match("GET", "/cookies");
    expectTypeOf<typeof match.matches>().toEqualTypeOf<[
        {
            type: "router";
            router: typeof tripleCookiesMiddleRouter;
            matches: [
                {
                    type: "router";
                    router: typeof tripleCookiesRouter;
                    matches: [
                        {
                            type: "handler";
                            handler: typeof tripleCookiesHandler;
                        }
                    ];
                }
            ];
        }
    ]>();
});

test("top-level router with /api prefix does not match /status without prefix", () => {
    type Ret = orRouterReturn<typeof prefixedRouter, "GET", "/status">;
    type _isLrNext = Ret extends typeof orNext ? true : false;
    const _v: _isLrNext = true;
});

// ─── Router prefix boundary protection at type level ───

const boundaryRouter = orRouter("", [
    orRouter("/api", [
        orHandler("GET", "/status", null, () => {
            return orResponse().json({ ok: true } as const);
        }),
    ] as const),
] as const);

test("nested /api prefix does not match /apiadmin/status at type level", () => {
    type Ret = orRouterReturn<typeof boundaryRouter, "GET", "/apiadmin/status">;
    type _isLrNext = Ret extends typeof orNext ? true : false;
    const _v: _isLrNext = true;
});

// ─── orRouterRequirements tests ───

test("orRouterRequirements with body validation requires zod input", () => {
    const router = orRouter("", [
        orHandler("POST", "/validate", {
            body: z.object({ name: z.string() }),
            failResponse: () => orResponse().status(400).text("fail"),
        }, () => orResponse().json({ ok: true } as const)),
    ] as const);
    type Reqs = orRouterRequirements<typeof router, "POST", "/validate">;
    type _hasName = Reqs extends { body: { name: string } } ? true : false;
    const _v: _hasName = true;
    type _filesOmitted = Reqs extends { files: unknown } ? true : false;
    const _filesCheck: _filesOmitted = false;
});

test("orRouterRequirements with files validation requires proper files type", () => {
    const router = orRouter("", [
        orHandler("POST", "/upload", {
            files: z.object({
                file: z.object({ name: z.string(), mimeType: z.string(), buffer: z.instanceof(Buffer) }),
            }),
            failResponse: () => orResponse().status(400).text("fail"),
        }, () => orResponse().json({ ok: true } as const)),
    ] as const);
    type Reqs = orRouterRequirements<typeof router, "POST", "/upload">;
    type _hasFiles = Reqs extends { files: { file: unknown } } ? true : false;
    const _v: _hasFiles = true;
});

test("orAppRequirements with files validation requires proper files type", () => {
    const router = orRouter("", [
        orHandler("POST", "/app-upload", {
            files: z.object({
                avatar: orFileSchema,
            }),
            failResponse: () => orResponse().status(400).text("fail"),
        }, () => orResponse().json({ ok: true } as const)),
    ] as const);
    const app = orApp(router, {
        errorResponse: orResponse().status(500).json({ error: true } as const),
        noHandlerResponse: () => orResponse().status(404).json({ not: "found" } as const),
    });
    type AppReqs = orAppRequirements<typeof app, "POST", "/app-upload">;
    type _hasFiles = AppReqs extends { files: { avatar: unknown } } ? true : false;
    const _v: _hasFiles = true;
});

// ─── orApp with response hooks type tests ───

test("orApp with addResponseHeaders includes header in return type", () => {
    const router = orRouter("", [
        orHandler("GET", "/hooked", null, () => orResponse().json({ ok: true } as const)),
    ] as const);

    const app = orApp(router, {
        errorResponse: orResponse().status(500).json({ error: true } as const),
        noHandlerResponse: () => orResponse().status(404).json({ not: "found" } as const),
        addResponseHeaders: async () => ({ "X-Hooked": "yes" }),
    });

    type AppRet = orAppReturn<typeof app, "GET", "/hooked">;
    type _isLrNext = AppRet extends typeof orNext ? true : false;
    const _a: _isLrNext = false;
    type _isResponse = AppRet extends orResponseObject ? true : false;
    const _b: _isResponse = true;
});

test("orApp with addResponseCookies includes cookie in return type", () => {
    const router = orRouter("", [
        orHandler("GET", "/cookies", null, () => orResponse().json({ ok: true } as const)),
    ] as const);

    const app = orApp(router, {
        errorResponse: orResponse().status(500).json({ error: true } as const),
        noHandlerResponse: () => orResponse().status(404).json({ not: "found" } as const),
        addResponseCookies: async () => ({ hooked: { value: "yes" } }),
    });

    type AppRet = orAppReturn<typeof app, "GET", "/cookies">;
    type _isResponse = AppRet extends orResponseObject ? true : false;
    const _v: _isResponse = true;
});

test("orApp with errorResponseFunction includes error response in union", () => {
    const router = orRouter("", [
        orHandler("GET", "/boom", null, () => {
            throw new Error("fail");
        }),
    ] as const);

    const app = orApp(router, {
        errorResponse: orResponse().status(500).json({ fallback: true } as const),
        noHandlerResponse: () => orResponse().status(404).json({ not: "found" } as const),
        errorResponseFunction: async () => orResponse().status(503).json({ handled: true } as const),
    });

    type AppRet = orAppReturn<typeof app, "GET", "/boom">;
    type _isResponse = AppRet extends orResponseObject ? true : false;
    const _v: _isResponse = true;
});

// ─── orHandler with array methods type inference ───

test("handler with array methods infers callback method type as union", () => {
    const h = orHandler(["GET", "POST"], "/multi", null, () => {
        return orResponse().text("multi");
    });
    type Ret = ReturnType<typeof h.callback>;
    type _isResponse = Ret extends LrResponse<any> ? true : false;
    const _v: _isResponse = true;
});

// ─── Nested router with multi-segment prefix at type level ───

const multiSegmentPrefixRouter = orRouter("", [
    orRouter("/foo/bar", [
        orHandler("GET", "/:id", null, () => {
            return orResponse().json({ id: "test" } as const);
        }),
    ] as const),
] as const);

test("nested multi-segment prefix /foo/bar with param matches /foo/bar/baz", () => {
    type Ret = orRouterReturn<typeof multiSegmentPrefixRouter, "GET", "/foo/bar/baz">;
    type _isResponse = Ret extends LrResponse<any> ? true : false;
    const _v: _isResponse = true;
});

test("nested multi-segment prefix /foo/bar consumes full path, no match", () => {
    type Ret = orRouterReturn<typeof multiSegmentPrefixRouter, "GET", "/foo/bar">;
    type _isLrNext = Ret extends typeof orNext ? true : false;
    const _v: _isLrNext = true;
});

// ─── Non-root router with nested prefix consumes full path ───

const nonRootFullPathRouter = orRouter("/api", [
    orRouter("/foo", [
        orHandler("GET", "/:id", null, () => {
            return orResponse().json({ reached: true } as const);
        }),
    ] as const),
] as const);

test("non-root router /api with nested /foo consumes /api/foo, no match", () => {
    type Ret = orRouterReturn<typeof nonRootFullPathRouter, "GET", "/api/foo">;
    type _isLrNext = Ret extends typeof orNext ? true : false;
    const _v: _isLrNext = true;
});

test("non-root router /api with nested /foo matches /api/foo/bar", () => {
    type Ret = orRouterReturn<typeof nonRootFullPathRouter, "GET", "/api/foo/bar">;
    type _isResponse = Ret extends LrResponse<any> ? true : false;
    const _v: _isResponse = true;
});

// ─── Sibling routes after nested orNext ───

const siblingFallthroughRouter = orRouter("", [
    orRouter("/api", [
        orHandler("GET", "/feature", null, () => orNext),
    ] as const),
    orHandler("GET", "/api/feature", null, () => {
        return orResponse().json({ fallback: true } as const);
    }),
] as const);

test("sibling route catches fallthrough when nested route returns orNext", () => {
    type Ret = orRouterReturn<typeof siblingFallthroughRouter, "GET", "/api/feature">;
    type _isResponse = Ret extends LrResponse<any> ? true : false;
    const _v: _isResponse = true;
});

// ─── orRouter with empty handlers returns orNext on any request ───

test("router with empty handlers returns orNext for any request", () => {
    const emptyRouter = orRouter("", [] as const);
    type Ret = orRouterReturn<typeof emptyRouter, "GET", "/anything">;
    type _isLrNext = Ret extends typeof orNext ? true : false;
    const _v: _isLrNext = true;
});

// ─── Files on request type tests ───

test("orRequest includes files property", () => {
    type Req = orRequest<"GET", "/test">;
    expectTypeOf<Req>().toExtend<{ files: Record<string, { name: string; mimeType: string; buffer: Buffer }> }>();
});

test("orHandlerRequest includes files property", () => {
    type Req = orHandlerRequest<"POST", "/upload", {}, {}, {}, {}>;
    expectTypeOf<Req>().toExtend<{ files: Record<string, { name: string; mimeType: string; buffer: Buffer }> }>();
});

test("handler with files validation types req.files", () => {
    const h = orHandler("POST", "/upload", {
        files: z.object({
            file: z.object({ name: z.string(), mimeType: z.string(), buffer: z.instanceof(Buffer) }),
        }),
        failResponse: () => orResponse().status(400).text("fail"),
    }, req => {
        expectTypeOf<typeof req.files>().toExtend<{ file: { name: string } }>();
        return orResponse().json({ ok: true } as const);
    });
});

test("orFileSchema is exported from library", () => {
    type Module = typeof import(".");
    expectTypeOf<Module>().toExtend<{ orFileSchema: z.ZodType }>();
});
