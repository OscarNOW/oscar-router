// © 2026 Oscar Knap - Alle rechten voorbehouden
import { describe, test } from "bun:test";
import { expectTypeOf } from "expect-type";
import { z } from "zod";
import { orRouter, orHandler, orResponse, orNext, orApp, orFileSchema, } from ".";
// ─── Basic type tests ───
test("httpMethod is a union of standard HTTP methods", () => {
    expectTypeOf().toEqualTypeOf();
});
test("orRequest shape with method and path", () => {
    expectTypeOf().toExtend();
    expectTypeOf().not.toExtend();
});
test("orHandlerRequest shape with params, query and body", () => {
    expectTypeOf().toExtend();
});
// ─── orResponse builder ───
test("orResponse builder returns LrResponse", () => {
    const res = orResponse();
    const _v = true;
});
// ─── Handler return type inference ───
test("handler returning orNext only", () => {
    const h = orHandler("GET", "/pass", null, () => orNext);
    const _a = true;
    const _b = false;
});
test("handler returning LrResponse only", () => {
    const h = orHandler("GET", "/ok", null, () => {
        return orResponse().status(200).text("ok");
    });
    const _a = false;
    const _b = true;
});
test("handler can return both orNext and LrResponse", () => {
    const h = orHandler("GET", "/maybe", null, () => {
        return Math.random() > 0.5 ? orNext : orResponse().status(200).text("ok");
    });
    const _a = true;
    const _b = true;
});
// ─── Router return type: basic ───
test("router with non-matching method returns orNext", () => {
    const router = orRouter("", [
        orHandler("GET", "/only-get", null, () => {
            return orResponse().status(200).text("get");
        }),
    ]);
    const _v = true;
});
test("router with matching handler returns LrResponse", () => {
    const router = orRouter("", [
        orHandler("GET", "/hello", null, () => {
            return orResponse().status(200).json({ message: "hello" });
        }),
    ]);
    const _a = false;
    const _b = true;
});
// ─── Edge case: nested router prefix consumes full path ───
const edgeRouter = orRouter("", [
    orRouter("/foo", [
        orHandler("GET", "/:id", null, () => {
            return orResponse().json({ reached: true });
        }),
    ]),
]);
test("nested prefix /foo consumes full path -> empty :id, no match", () => {
    const _v = true;
});
test("nested prefix /foo with extra path /foo/bar matches :id", () => {
    const _a = false;
    const _b = true;
});
// ─── Edge case: root param with empty path vs value ───
const rootParamRouter = orRouter("", [
    orHandler("GET", "/:id", null, () => {
        return orResponse().json({ reached: true });
    }),
]);
test("root param /:id does NOT match path /", () => {
    const _v = true;
});
test("root param /:id matches path /hello", () => {
    const _a = false;
    const _b = true;
});
// ─── Edge case: deep nesting ───
const deepEdgeRouter = orRouter("", [
    orRouter("/a", [
        orRouter("/b", [
            orHandler("GET", "/:id", null, () => {
                return orResponse().json({ reached: true });
            }),
        ]),
    ]),
]);
test("deep nested prefix /a/b consumes full path, no match", () => {
    const _v = true;
});
test("deep nested path /a/b/c matches :id", () => {
    const _a = false;
    const _b = true;
});
// ─── orApp return type ───
test("orApp with no match returns noHandlerResponse", () => {
    const router = orRouter("", [
        orHandler("GET", "/exists", null, () => {
            return orResponse().status(200).text("here");
        }),
    ]);
    const app = orApp(router, {
        errorResponse: orResponse().status(500).json({ error: true }),
        noHandlerResponse: () => orResponse().status(404).json({ not: "found" }),
    });
    const _v = false;
});
// ─── orRequest isHead property ───
test("orRequest GET has isHead as boolean", () => {
    expectTypeOf().toEqualTypeOf();
});
test("orRequest non-GET has isHead as false", () => {
    expectTypeOf().toEqualTypeOf();
});
// ─── orResponse type inference ───
test("orResponse.json sets Content-Type and body type", () => {
    const res = orResponse().json({ message: "hello" });
    const _v = true;
});
test("orResponse.text sets Content-Type and body type", () => {
    const res = orResponse().status(201).text("created");
    const _v = true;
    const _b = true;
});
test("orResponse.html sets Content-Type to text/html", () => {
    const res = orResponse().html("<h1>hello</h1>");
    const _v = true;
});
test("orResponse.status changes status type", () => {
    const res = orResponse().status(404);
    const _v = true;
});
test("orResponse.header adds to headers type", () => {
    const res = orResponse().header("X-Custom", "value");
    const _v = true;
});
test("orResponse.redirect sets status 307 and Location header", () => {
    const res = orResponse().redirect("/next");
    const _a = true;
    const _b = true;
});
test("orResponse.permanentRedirect sets status 308 and Location header", () => {
    const res = orResponse().permanentRedirect("/forever");
    const _a = true;
    const _b = true;
});
test("orResponse.buffer sets Content-Type octet-stream", () => {
    const res = orResponse().type("application/octet-stream").buffer(Buffer.from("abc"));
    const _v = true;
});
test("orResponse.type overrides Content-Type", () => {
    const res = orResponse().type("application/xml");
    const _v = true;
});
// ─── Router return type: wildcard method ───
test("router with wildcard method matches any method", () => {
    const router = orRouter("", [
        orHandler("*", "/wild", null, () => {
            return orResponse().status(200).text("wild");
        }),
    ]);
    const _a = true;
    const _b = true;
});
// ─── Router return type: rest route ───
const restRouter = orRouter("", [
    orHandler("GET", "/files/*", null, () => {
        return orResponse().json({ type: "rest" });
    }),
]);
test("rest route matches extra path segments", () => {
    const _v = true;
});
test("rest route matches path with zero extra segments", () => {
    const _v = true;
});
// ─── Router return type: fallthrough ───
const fallthroughRouter = orRouter("", [
    orHandler("GET", "/chain", null, () => orNext),
    orHandler("GET", "/chain", null, () => {
        return orResponse().json({ second: true });
    }),
]);
test("router fallthrough: first handler returns orNext, second returns response", () => {
    const _v = true;
});
// ─── Router return type: non-matching path after method match ───
test("router with matching method but non-matching path returns orNext", () => {
    const router = orRouter("", [
        orHandler("GET", "/only-this", null, () => {
            return orResponse().status(200).text("here");
        }),
    ]);
    const _v = true;
});
// ─── Router return type: multiple handlers on different routes ───
test("router with multiple handlers on different paths resolves correctly", () => {
    const router = orRouter("", [
        orHandler("GET", "/a", null, () => orResponse().text("a")),
        orHandler("GET", "/b", null, () => orResponse().text("b")),
    ]);
    const _a = true;
    const _b = true;
});
// ─── Router return type: non-empty top-level prefix ───
const prefixedRouter = orRouter("/api", [
    orHandler("GET", "/status", null, () => {
        return orResponse().json({ ok: true });
    }),
]);
test("top-level router with /api prefix matches full path /api/status", () => {
    const _v = true;
});
const showsRouter = orRouter("/shows", [
    orHandler("GET", "/", null, () => {
        return orResponse().json({ ok: true });
    }),
]);
test("top-level router /shows with root handler matches path /shows", () => {
    const _v = true;
});
const tripleCookiesHandler = orHandler("GET", "/", {
    query: z.object({ session: z.string() }),
    failResponse: () => orResponse().status(400).text("fail"),
}, () => {
    return orResponse().json({ cookies: true });
});
const tripleCookiesRouter = orRouter("/cookies", [
    tripleCookiesHandler,
]);
const tripleCookiesMiddleRouter = orRouter("", [
    tripleCookiesRouter,
]);
const tripleCookiesRootRouter = orRouter("", [
    tripleCookiesMiddleRouter,
]);
test("router -> router -> router /cookies -> handler GET / return type matches /cookies", () => {
    const _a = true;
    const _b = false;
});
test("router -> router -> router /cookies -> handler GET / requirements match /cookies", () => {
    const _v = true;
});
test("router -> router -> router /cookies -> handler GET / match type nests routers", () => {
    const match = tripleCookiesRootRouter.match("GET", "/cookies");
    expectTypeOf().toEqualTypeOf();
});
test("top-level router with /api prefix does not match /status without prefix", () => {
    const _v = true;
});
// ─── Router prefix boundary protection at type level ───
const boundaryRouter = orRouter("", [
    orRouter("/api", [
        orHandler("GET", "/status", null, () => {
            return orResponse().json({ ok: true });
        }),
    ]),
]);
test("nested /api prefix does not match /apiadmin/status at type level", () => {
    const _v = true;
});
// ─── orRouterRequirements tests ───
test("orRouterRequirements with body validation requires zod input", () => {
    const router = orRouter("", [
        orHandler("POST", "/validate", {
            body: z.object({ name: z.string() }),
            failResponse: () => orResponse().status(400).text("fail"),
        }, () => orResponse().json({ ok: true })),
    ]);
    const _v = true;
    const _filesCheck = false;
});
test("orRouterRequirements with files validation requires proper files type", () => {
    const router = orRouter("", [
        orHandler("POST", "/upload", {
            files: z.object({
                file: z.object({ name: z.string(), mimeType: z.string(), buffer: z.instanceof(Buffer) }),
            }),
            failResponse: () => orResponse().status(400).text("fail"),
        }, () => orResponse().json({ ok: true })),
    ]);
    const _v = true;
});
test("orAppRequirements with files validation requires proper files type", () => {
    const router = orRouter("", [
        orHandler("POST", "/app-upload", {
            files: z.object({
                avatar: orFileSchema,
            }),
            failResponse: () => orResponse().status(400).text("fail"),
        }, () => orResponse().json({ ok: true })),
    ]);
    const app = orApp(router, {
        errorResponse: orResponse().status(500).json({ error: true }),
        noHandlerResponse: () => orResponse().status(404).json({ not: "found" }),
    });
    const _v = true;
});
// ─── orApp with response hooks type tests ───
test("orApp with addResponseHeaders includes header in return type", () => {
    const router = orRouter("", [
        orHandler("GET", "/hooked", null, () => orResponse().json({ ok: true })),
    ]);
    const app = orApp(router, {
        errorResponse: orResponse().status(500).json({ error: true }),
        noHandlerResponse: () => orResponse().status(404).json({ not: "found" }),
        addResponseHeaders: async () => ({ "X-Hooked": "yes" }),
    });
    const _a = false;
    const _b = true;
});
test("orApp with addResponseCookies includes cookie in return type", () => {
    const router = orRouter("", [
        orHandler("GET", "/cookies", null, () => orResponse().json({ ok: true })),
    ]);
    const app = orApp(router, {
        errorResponse: orResponse().status(500).json({ error: true }),
        noHandlerResponse: () => orResponse().status(404).json({ not: "found" }),
        addResponseCookies: async () => ({ hooked: { value: "yes" } }),
    });
    const _v = true;
});
test("orApp with errorResponseFunction includes error response in union", () => {
    const router = orRouter("", [
        orHandler("GET", "/boom", null, () => {
            throw new Error("fail");
        }),
    ]);
    const app = orApp(router, {
        errorResponse: orResponse().status(500).json({ fallback: true }),
        noHandlerResponse: () => orResponse().status(404).json({ not: "found" }),
        errorResponseFunction: async () => orResponse().status(503).json({ handled: true }),
    });
    const _v = true;
});
// ─── orHandler with array methods type inference ───
test("handler with array methods infers callback method type as union", () => {
    const h = orHandler(["GET", "POST"], "/multi", null, () => {
        return orResponse().text("multi");
    });
    const _v = true;
});
// ─── Nested router with multi-segment prefix at type level ───
const multiSegmentPrefixRouter = orRouter("", [
    orRouter("/foo/bar", [
        orHandler("GET", "/:id", null, () => {
            return orResponse().json({ id: "test" });
        }),
    ]),
]);
test("nested multi-segment prefix /foo/bar with param matches /foo/bar/baz", () => {
    const _v = true;
});
test("nested multi-segment prefix /foo/bar consumes full path, no match", () => {
    const _v = true;
});
// ─── Non-root router with nested prefix consumes full path ───
const nonRootFullPathRouter = orRouter("/api", [
    orRouter("/foo", [
        orHandler("GET", "/:id", null, () => {
            return orResponse().json({ reached: true });
        }),
    ]),
]);
test("non-root router /api with nested /foo consumes /api/foo, no match", () => {
    const _v = true;
});
test("non-root router /api with nested /foo matches /api/foo/bar", () => {
    const _v = true;
});
// ─── Sibling routes after nested orNext ───
const siblingFallthroughRouter = orRouter("", [
    orRouter("/api", [
        orHandler("GET", "/feature", null, () => orNext),
    ]),
    orHandler("GET", "/api/feature", null, () => {
        return orResponse().json({ fallback: true });
    }),
]);
test("sibling route catches fallthrough when nested route returns orNext", () => {
    const _v = true;
});
// ─── orRouter with empty handlers returns orNext on any request ───
test("router with empty handlers returns orNext for any request", () => {
    const emptyRouter = orRouter("", []);
    const _v = true;
});
// ─── Files on request type tests ───
test("orRequest includes files property", () => {
    expectTypeOf().toExtend();
});
test("orHandlerRequest includes files property", () => {
    expectTypeOf().toExtend();
});
test("handler with files validation types req.files", () => {
    const h = orHandler("POST", "/upload", {
        files: z.object({
            file: z.object({ name: z.string(), mimeType: z.string(), buffer: z.instanceof(Buffer) }),
        }),
        failResponse: () => orResponse().status(400).text("fail"),
    }, req => {
        expectTypeOf().toExtend();
        return orResponse().json({ ok: true });
    });
});
test("orFileSchema is exported from library", () => {
    expectTypeOf().toExtend();
});
