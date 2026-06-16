// AI TESTS
import { afterAll, describe, expect, test } from "bun:test";
import { request } from "node:http";
import { connect } from "node:net";
import { z } from "zod";
import { orApp, orHandler, orNext, orResponse, orRouter } from ".";
const servers = [];
function createTestServer(handlers) {
    return createRouterServer(orRouter('', Array.isArray(handlers) ? handlers : [handlers]));
}
function createRouterServer(router) {
    const app = orApp(router, {
        errorResponse: orResponse().status(500).json({ ok: false }),
        noHandlerResponse: () => orResponse().status(404).json({ ok: false }),
    });
    return listenToApp(app);
}
function listenToApp(app) {
    const server = app.createServer();
    servers.push(server);
    return new Promise(resolve => {
        server.listen(0, () => resolve(server));
    });
}
function httpRequest(server, options = {}) {
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Test server is not listening on a TCP port');
    }
    return new Promise((resolve, reject) => {
        const req = request({
            port: address.port,
            method: options.method ?? 'GET',
            path: options.path ?? '/',
            headers: options.headers,
        }, res => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', chunk => {
                body += chunk;
            });
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body,
                });
            });
        });
        req.on('error', reject);
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}
function multipartBody(boundary, parts) {
    return parts.map(part => {
        const disposition = [
            `form-data; name="${part.name}"`,
            part.filename ? `filename="${part.filename}"` : null,
        ].filter(Boolean).join('; ');
        return [
            `--${boundary}`,
            `Content-Disposition: ${disposition}`,
            part.contentType ? `Content-Type: ${part.contentType}` : null,
            '',
            part.value,
        ].filter(line => line !== null).join('\r\n');
    }).join('\r\n') + `\r\n--${boundary}--\r\n`;
}
function rawHttpRequest(server, requestText) {
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Test server is not listening on a TCP port');
    }
    return new Promise((resolve, reject) => {
        const socket = connect(address.port, '127.0.0.1');
        let responseText = '';
        socket.setEncoding('utf8');
        socket.on('connect', () => {
            socket.write(requestText);
        });
        socket.on('data', chunk => {
            responseText += chunk;
        });
        socket.on('error', reject);
        socket.on('end', () => {
            const [head = '', body = ''] = responseText.split('\r\n\r\n');
            const statusLine = head.split('\r\n')[0] ?? '';
            const status = Number(statusLine.split(' ')[1]);
            const headers = Object.create(null);
            for (const line of head.split('\r\n').slice(1)) {
                const separatorIndex = line.indexOf(':');
                if (separatorIndex <= 0)
                    continue;
                headers[line.slice(0, separatorIndex).toLowerCase()] = line.slice(separatorIndex + 1).trim();
            }
            resolve({ status, headers, body });
        });
    });
}
function rawIdleRequest(server, requestText) {
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Test server is not listening on a TCP port');
    }
    return new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const socket = connect(address.port, '127.0.0.1');
        let responseText = '';
        socket.setEncoding('utf8');
        socket.on('connect', () => {
            socket.write(requestText);
        });
        socket.on('data', chunk => {
            responseText += chunk;
        });
        socket.on('error', reject);
        socket.on('close', () => {
            resolve({
                closedAfterMs: Date.now() - startedAt,
                responseText,
            });
        });
    });
}
function largeJsonRequest(server, path, chunkCount) {
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Test server is not listening on a TCP port');
    }
    return new Promise(resolve => {
        const chunk = 'a'.repeat(1024 * 1024);
        let bytesAttempted = '{"data":"'.length;
        let settled = false;
        const finish = (result) => {
            if (settled)
                return;
            settled = true;
            resolve({ ...result, bytesAttempted });
        };
        const req = request({
            port: address.port,
            method: 'POST',
            path,
            headers: {
                'Content-Type': 'application/json',
            },
        }, res => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', data => {
                body += data;
            });
            res.on('end', () => {
                finish({ status: res.statusCode, body });
            });
        });
        req.on('error', (error) => {
            finish({ body: '', errorCode: error.code });
        });
        req.write('{"data":"');
        const writeChunks = async () => {
            try {
                for (let i = 0; i < chunkCount && !settled; i++) {
                    bytesAttempted += chunk.length;
                    if (!req.write(chunk)) {
                        await new Promise(resolveDrain => req.once('drain', resolveDrain));
                    }
                }
                bytesAttempted += '"}'.length;
                req.end('"}');
            }
            catch (error) {
                finish({ body: '', errorCode: error.code });
            }
        };
        void writeChunks();
    });
}
afterAll(async () => {
    await Promise.all(servers.map(server => new Promise(resolve => {
        server.close(() => resolve());
    })));
});
describe('features: normal request handling', () => {
    test('returns text responses with status and content type', async () => {
        const server = await createTestServer(orHandler(['GET'], '/hello', null, () => {
            return orResponse().status(201).text('created');
        }));
        const response = await httpRequest(server, {
            path: '/hello',
        });
        expect(response.status).toBe(201);
        expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
        expect(response.body).toBe('created');
    });
    test('parses JSON request bodies and exposes them to handlers', async () => {
        const server = await createTestServer(orHandler(['POST'], '/json', null, req => {
            return orResponse().json({
                body: req.body,
            });
        }));
        const response = await httpRequest(server, {
            method: 'POST',
            path: '/json',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({ name: 'Oscar', nested: { ok: true }, list: [1, 2, 3] }),
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
            body: { name: 'Oscar', nested: { ok: true }, list: [1, 2, 3] },
        });
    });
    test('parses urlencoded request bodies including repeated keys', async () => {
        const server = await createTestServer(orHandler(['POST'], '/form', null, req => {
            return orResponse().json({
                body: req.body,
            });
        }));
        const response = await httpRequest(server, {
            method: 'POST',
            path: '/form',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'name=Oscar&tag=one&tag=two&empty=',
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
            body: {
                name: 'Oscar',
                tag: ['one', 'two'],
                empty: '',
            },
        });
    });
    test('parses multipart fields and files', async () => {
        const boundary = 'oscar-router-test-boundary';
        const server = await createTestServer(orHandler(['POST'], '/multipart', null, req => {
            return orResponse().json({
                title: req.body.title,
                fileName: req.files.upload.name,
                fileType: req.files.upload.mimeType,
                fileText: req.files.upload.buffer.toString('utf8'),
            });
        }));
        const response = await httpRequest(server, {
            method: 'POST',
            path: '/multipart',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
            },
            body: multipartBody(boundary, [
                { name: 'title', value: 'Quarter Final' },
                { name: 'upload', filename: 'match.txt', contentType: 'text/plain', value: 'Ajax 2-1 PSV' },
            ]),
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
            title: 'Quarter Final',
            fileName: 'match.txt',
            fileType: 'text/plain',
            fileText: 'Ajax 2-1 PSV',
        });
    });
    test('parses multipart fields and keeps empty strings as empty strings', async () => {
        const boundary = 'oscar-router-test-boundary';
        const server = await createTestServer(orHandler(['POST'], '/multipart-empty', null, req => {
            return orResponse().json({
                empty: req.body.empty,
            });
        }));
        const response = await httpRequest(server, {
            method: 'POST',
            path: '/multipart-empty',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
            },
            body: multipartBody(boundary, [
                { name: 'empty', value: '' },
            ]),
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ empty: '' });
    });
    test('uses null for unsupported content types', async () => {
        const server = await createTestServer(orHandler(['POST'], '/raw', null, req => {
            return orResponse().json({
                body: req.body,
            });
        }));
        const response = await httpRequest(server, {
            method: 'POST',
            path: '/raw',
            headers: {
                'Content-Type': 'application/octet-stream',
            },
            body: 'raw-body',
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ body: null });
    });
    test('handles root routes explicitly', async () => {
        const server = await createTestServer(orHandler(['GET'], '/', null, req => {
            return orResponse().json({
                path: req.path,
            });
        }));
        const response = await httpRequest(server, {
            path: '/',
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ path: '/' });
    });
    test('returns the configured no-handler response for unmatched routes', async () => {
        const server = await createTestServer(orHandler(['GET'], '/known', null, () => {
            return orResponse().json({ reached: true });
        }));
        const response = await httpRequest(server, {
            path: '/missing',
        });
        expect(response.status).toBe(404);
        expect(JSON.parse(response.body)).toEqual({ ok: false });
    });
});
describe('features: route matching and fallthrough', () => {
    test('matches handlers by HTTP method', async () => {
        const server = await createTestServer([
            orHandler(['GET'], '/resource', null, () => {
                return orResponse().json({ method: 'GET' });
            }),
            orHandler(['POST'], '/resource', null, () => {
                return orResponse().json({ method: 'POST' });
            }),
        ]);
        const getResponse = await httpRequest(server, {
            method: 'GET',
            path: '/resource',
        });
        const postResponse = await httpRequest(server, {
            method: 'POST',
            path: '/resource',
        });
        expect(JSON.parse(getResponse.body)).toEqual({ method: 'GET' });
        expect(JSON.parse(postResponse.body)).toEqual({ method: 'POST' });
    });
    test('supports all explicitly allowed HTTP methods', async () => {
        const methods = ['PUT', 'DELETE', 'PATCH', 'OPTIONS'];
        const server = await createTestServer(methods.map(method => orHandler([method], '/resource', null, req => {
            return orResponse().json({ method: req.method });
        })));
        for (const method of methods) {
            const response = await httpRequest(server, {
                method,
                path: '/resource',
            });
            expect(response.status).toBe(200);
            expect(JSON.parse(response.body)).toEqual({ method });
        }
    });
    test('treats HEAD as GET and runs wildcard handlers with no body', async () => {
        let handlerReached = false;
        const server = await createTestServer(orHandler('*', '/head', null, () => {
            handlerReached = true;
            return orResponse().json({ reached: true });
        }));
        const response = await httpRequest(server, {
            method: 'HEAD',
            path: '/head',
        });
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(response.body).toBe('');
        expect(handlerReached).toBe(true);
    });
    test('HEAD request matches GET handlers and returns no body', async () => {
        const server = await createTestServer(orHandler(['GET'], '/resource', null, () => {
            return orResponse().json({ data: 'test' });
        }));
        const response = await httpRequest(server, {
            method: 'HEAD',
            path: '/resource',
        });
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(response.body).toBe('');
    });
    test('HEAD request appears as GET in handler', async () => {
        let handlerMethod = '';
        const server = await createTestServer(orHandler(['GET'], '/method-check', null, (req) => {
            handlerMethod = req.method;
            return orResponse().json({ method: req.method });
        }));
        await httpRequest(server, {
            method: 'HEAD',
            path: '/method-check',
        });
        expect(handlerMethod).toBe('GET');
    });
    test('HEAD request to unmatched path returns 404 with no body', async () => {
        const server = await createTestServer(orHandler(['GET'], '/known', null, () => {
            return orResponse().json({ ok: true });
        }));
        const response = await httpRequest(server, {
            method: 'HEAD',
            path: '/unknown',
        });
        expect(response.status).toBe(404);
        expect(response.body).toBe('');
    });
    test('runs later matching handlers when an earlier handler returns orNext', async () => {
        const calls = [];
        const server = await createTestServer([
            orHandler(['GET'], '/chain', null, () => {
                calls.push('first');
                return orNext;
            }),
            orHandler(['GET'], '/chain', null, () => {
                calls.push('second');
                return orResponse().json({ calls });
            }),
        ]);
        const response = await httpRequest(server, {
            path: '/chain',
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ calls: ['first', 'second'] });
    });
    test('stops at the first matching handler that returns a response', async () => {
        let secondReached = false;
        const server = await createTestServer([
            orHandler(['GET'], '/chain', null, () => {
                return orResponse().json({ handler: 'first' });
            }),
            orHandler(['GET'], '/chain', null, () => {
                secondReached = true;
                return orResponse().json({ handler: 'second' });
            }),
        ]);
        const response = await httpRequest(server, {
            path: '/chain',
        });
        expect(JSON.parse(response.body)).toEqual({ handler: 'first' });
        expect(secondReached).toBe(false);
    });
    test('captures multiple named params without decoding path segments', async () => {
        const server = await createTestServer(orHandler(['GET'], '/teams/:teamId/members/:memberId', null, req => {
            const params = req.params;
            return orResponse().json({
                teamId: params.teamId ?? null,
                memberId: params.memberId ?? null,
            });
        }));
        const response = await httpRequest(server, {
            path: '/teams/league%20fm/members/oscar',
        });
        expect(JSON.parse(response.body)).toEqual({
            teamId: 'league%20fm',
            memberId: 'oscar',
        });
    });
});
describe('features: validations', () => {
    test('returns validation failResponse when body validation fails', async () => {
        let handlerReached = false;
        const server = await createTestServer(orHandler(['POST'], '/validate', {
            body: z.object({
                name: z.string(),
                count: z.number(),
            }),
            failResponse: (errors) => {
                return orResponse().status(400).json({
                    bodyError: Boolean(errors.bodyError),
                });
            },
        }, () => {
            handlerReached = true;
            return orResponse().json({ ok: true });
        }));
        const response = await httpRequest(server, {
            method: 'POST',
            path: '/validate',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: 'Oscar', count: 'not-a-number' }),
        });
        expect(response.status).toBe(400);
        expect(handlerReached).toBe(false);
        expect(JSON.parse(response.body)).toEqual({ bodyError: true });
    });
    test('passes transformed query and params into the handler after validation', async () => {
        const server = await createTestServer(orHandler(['GET'], '/items/:id', {
            query: z.object({
                page: z.string().transform(value => Number(value)),
            }),
            params: z.object({
                id: z.string().transform(value => Number(value)),
            }),
            failResponse: () => orResponse().status(400).json({ ok: false }),
        }, req => {
            return orResponse().json({
                id: req.params.id,
                page: req.query.page,
            });
        }));
        const response = await httpRequest(server, {
            path: '/items/42?page=3',
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
            id: 42,
            page: 3,
        });
    });
    test('validates files with files schema and transform', async () => {
        const boundary = 'oscar-router-test-boundary';
        const localFileSchema = z.object({
            name: z.string(),
            mimeType: z.string(),
            buffer: z.instanceof(Buffer),
        });
        const server = await createTestServer(orHandler(['POST'], '/validate-files', {
            files: z.object({
                upload: localFileSchema.transform(file => ({
                    ...file,
                    name: file.name.toUpperCase(),
                })),
            }),
            failResponse: () => orResponse().status(400).json({ ok: false }),
        }, req => {
            return orResponse().json({
                fileName: req.files.upload.name,
            });
        }));
        const response = await httpRequest(server, {
            method: 'POST',
            path: '/validate-files',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
            },
            body: multipartBody(boundary, [
                { name: 'upload', filename: 'test.txt', contentType: 'text/plain', value: 'content' },
            ]),
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ fileName: 'TEST.TXT' });
    });
});
describe('features: nested routers', () => {
    test('matches a single-level nested router with a prefix', async () => {
        const server = await createRouterServer(orRouter('', [
            orRouter('/api', [
                orHandler(['GET'], '/status', null, () => {
                    return orResponse().json({ ok: true });
                }),
            ]),
        ]));
        const response = await httpRequest(server, {
            path: '/api/status',
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ ok: true });
    });
    test('matches a two-level nested router with accumulated prefixes', async () => {
        const server = await createRouterServer(orRouter('', [
            orRouter('/api', [
                orRouter('/v1', [
                    orHandler(['GET'], '/status', null, () => {
                        return orResponse().json({ version: 1 });
                    }),
                ]),
            ]),
        ]));
        const response = await httpRequest(server, {
            path: '/api/v1/status',
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ version: 1 });
    });
    test('continues to sibling routes when a nested route returns orNext', async () => {
        const server = await createRouterServer(orRouter('', [
            orRouter('/api', [
                orHandler(['GET'], '/feature', null, () => orNext),
            ]),
            orHandler(['GET'], '/api/feature', null, () => {
                return orResponse().json({ fallback: true });
            }),
        ]));
        const response = await httpRequest(server, {
            path: '/api/feature',
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ fallback: true });
    });
    test('matches a top-level router with a non-empty prefix', async () => {
        const server = await createRouterServer(orRouter('/api', [
            orHandler(['GET'], '/status', null, () => {
                return orResponse().json({ ok: true });
            }),
        ]));
        const response = await httpRequest(server, {
            path: '/api/status',
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ ok: true });
    });
    test('router prefix /shows with root handler / matches request to /shows', async () => {
        const server = await createRouterServer(orRouter('/shows', [
            orHandler(['GET'], '/', null, () => {
                return orResponse().json({ ok: true });
            }),
        ]));
        const response = await httpRequest(server, {
            path: '/shows',
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ ok: true });
    });
    test('matches router -> router -> router /cookies -> handler GET /', () => {
        const handler = orHandler(['GET'], '/', null, () => {
            return orResponse().json({ cookies: true });
        });
        const cookiesRouter = orRouter('/cookies', [handler]);
        const middleRouter = orRouter('', [cookiesRouter]);
        const router = orRouter('', [middleRouter]);
        const match = router.match('GET', '/cookies');
        expect(match.matches).toHaveLength(1);
        expect(match.matches[0]?.type).toBe('router');
        const firstRouterMatch = match.matches[0];
        expect(firstRouterMatch?.type).toBe('router');
        if (firstRouterMatch?.type !== 'router')
            throw new Error('expected first router match');
        expect(firstRouterMatch.router).toBe(middleRouter);
        expect(firstRouterMatch.matches).toHaveLength(1);
        const secondRouterMatch = firstRouterMatch.matches[0];
        expect(secondRouterMatch?.type).toBe('router');
        if (secondRouterMatch?.type !== 'router')
            throw new Error('expected second router match');
        expect(secondRouterMatch.router).toBe(cookiesRouter);
        expect(secondRouterMatch.matches).toHaveLength(1);
        const handlerMatch = secondRouterMatch.matches[0];
        expect(handlerMatch?.type).toBe('handler');
        if (handlerMatch?.type !== 'handler')
            throw new Error('expected handler match');
        expect(handlerMatch.handler).toBe(handler);
    });
    test('does not confuse router prefix boundaries', async () => {
        const server = await createRouterServer(orRouter('', [
            orRouter('/api', [
                orHandler(['GET'], '/status', null, () => {
                    return orResponse().json({ ok: true });
                }),
            ]),
        ]));
        const response = await httpRequest(server, {
            path: '/apiadmin/status',
        });
        expect(response.status).toBe(404);
        expect(JSON.parse(response.body)).toEqual({ ok: false });
    });
    test('does not match a nested param route when the router prefix consumes the full request path', async () => {
        const server = await createRouterServer(orRouter('', [
            orRouter('/foo', [
                orHandler(['GET'], '/:id', null, () => {
                    return orResponse().json({ reached: true });
                }),
            ]),
        ]));
        const response = await httpRequest(server, {
            path: '/foo',
        });
        expect(response.status).toBe(404);
        expect(JSON.parse(response.body)).toEqual({ ok: false });
    });
    test('does not match a nested param route with deep multi-segment prefix that consumes the full path', async () => {
        const server = await createRouterServer(orRouter('', [
            orRouter('/foo/bar', [
                orHandler(['GET'], '/:id', null, () => {
                    return orResponse().json({ reached: true });
                }),
            ]),
        ]));
        const response = await httpRequest(server, {
            path: '/foo/bar',
        });
        expect(response.status).toBe(404);
        expect(JSON.parse(response.body)).toEqual({ ok: false });
    });
    test('does not match a top-level param route when the request path is the root', async () => {
        const server = await createRouterServer(orRouter('', [
            orHandler(['GET'], '/:id', null, () => {
                return orResponse().json({ reached: true });
            }),
        ]));
        const response = await httpRequest(server, {
            path: '/',
        });
        expect(response.status).toBe(404);
        expect(JSON.parse(response.body)).toEqual({ ok: false });
    });
    test('does not match a deeply nested param route with three levels of nesting consuming the full path', async () => {
        const server = await createRouterServer(orRouter('', [
            orRouter('/a', [
                orRouter('/b', [
                    orHandler(['GET'], '/:id', null, () => {
                        return orResponse().json({ reached: true });
                    }),
                ]),
            ]),
        ]));
        const response = await httpRequest(server, {
            path: '/a/b',
        });
        expect(response.status).toBe(404);
        expect(JSON.parse(response.body)).toEqual({ ok: false });
    });
    test('does not match a param route when only a literal segment is present after the prefix', async () => {
        const server = await createRouterServer(orRouter('', [
            orRouter('/foo', [
                orHandler(['GET'], '/:id/extra', null, () => {
                    return orResponse().json({ reached: true });
                }),
            ]),
        ]));
        const response = await httpRequest(server, {
            path: '/foo',
        });
        expect(response.status).toBe(404);
        expect(JSON.parse(response.body)).toEqual({ ok: false });
    });
    test('does not match a param route in a non-root router when the prefix consumes the full path', async () => {
        const server = await createRouterServer(orRouter('/api', [
            orRouter('/foo', [
                orHandler(['GET'], '/:id', null, () => {
                    return orResponse().json({ reached: true });
                }),
            ]),
        ]));
        const response = await httpRequest(server, {
            path: '/api/foo',
        });
        expect(response.status).toBe(404);
        expect(JSON.parse(response.body)).toEqual({ ok: false });
    });
    test('matches a nested param route correctly when the param value is present', async () => {
        const server = await createRouterServer(orRouter('', [
            orRouter('/foo', [
                // @ts-ignore idk why there is an error. sometimes there is an error and sometimes there is not
                orHandler(['GET'], '/:id', null, req => {
                    const params = req.params;
                    return orResponse().json({ id: params.id ?? null });
                }),
            ]),
        ]));
        const response = await httpRequest(server, {
            path: '/foo/bar',
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ id: 'bar' });
    });
    test('matches a nested param route correctly with deep multi-segment prefix', async () => {
        const server = await createRouterServer(orRouter('', [
            orRouter('/foo/bar', [
                // @ts-ignore idk why there is an error. sometimes there is an error and sometimes there is not
                orHandler(['GET'], '/:id', null, req => {
                    const params = req.params;
                    return orResponse().json({ id: params.id ?? null });
                }),
            ]),
        ]));
        const response = await httpRequest(server, {
            path: '/foo/bar/baz',
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ id: 'baz' });
    });
    test('matches a nested param route correctly at the top level', async () => {
        const server = await createRouterServer(orRouter('', [
            // @ts-ignore idk why there is an error. sometimes there is an error and sometimes there is not
            orHandler('GET', '/:id', null, req => {
                const params = req.params;
                return orResponse().json({ id: params.id ?? null });
            }),
        ]));
        const response = await httpRequest(server, {
            path: '/hello',
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ id: 'hello' });
    });
});
describe('features: direct execute APIs', () => {
    test('executes routers directly without Node HTTP', async () => {
        const router = orRouter('', [
            orHandler(['GET'], '/direct/:id', null, (req) => {
                const params = req.params;
                return orResponse().json({ id: params.id ?? null });
            }),
        ]);
        const response = await router.execute({
            method: 'GET',
            isHead: false,
            path: '/direct/abc',
            url: '/direct/abc',
            params: null,
            query: Object.create(null),
            body: null,
            files: Object.create(null),
            data: Object.create(null),
            ip: '127.0.0.1',
            headers: Object.create(null),
            cookies: Object.create(null),
        });
        const orResponseObject = response;
        expect(orResponseObject.response.status).toBe(200);
        expect(orResponseObject.response.body).toEqual({
            type: 'json',
            body: { id: 'abc' },
        });
    });
    test('executes apps directly and applies global response hooks', async () => {
        const app = orApp(orRouter('', [
            orHandler(['GET'], '/direct', null, () => orResponse().text('ok')),
        ]), {
            errorResponse: orResponse().status(500).json({ ok: false }),
            noHandlerResponse: () => orResponse().status(404).json({ ok: false }),
            addResponseHeaders: async () => ({ 'X-Direct': 'yes' }),
            addResponseCookies: async () => ({ direct: { value: 'yes' } }),
        });
        const response = await app.execute({
            method: 'GET',
            isHead: false,
            path: '/direct',
            url: '/direct',
            params: null,
            query: Object.create(null),
            body: null,
            files: Object.create(null),
            data: Object.create(null),
            ip: '127.0.0.1',
            headers: Object.create(null),
            cookies: Object.create(null),
        });
        expect(response.status).toBe(200);
        expect(response.headers['X-Direct']).toBe('yes');
        expect(response.cookies.direct.value).toBe('yes');
    });
});
describe('features: response helpers', () => {
    test('supports redirects and permanent redirects', async () => {
        const server = await createTestServer([
            orHandler(['GET'], '/temporary', null, () => orResponse().redirect('/next')),
            orHandler(['GET'], '/permanent', null, () => orResponse().permanentRedirect('/forever')),
        ]);
        const temporary = await httpRequest(server, {
            path: '/temporary',
        });
        const permanent = await httpRequest(server, {
            path: '/permanent',
        });
        expect(temporary.status).toBe(307);
        expect(temporary.headers.location).toBe('/next');
        expect(permanent.status).toBe(308);
        expect(permanent.headers.location).toBe('/forever');
    });
    test('supports buffer responses with an explicit content type', async () => {
        const server = await createTestServer(orHandler(['GET'], '/buffer', null, () => {
            return orResponse()
                .type('application/octet-stream')
                .buffer(Buffer.from('abc'));
        }));
        const response = await httpRequest(server, {
            path: '/buffer',
        });
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/octet-stream');
        expect(response.body).toBe('abc');
    });
    test('supports html responses', async () => {
        const server = await createTestServer(orHandler(['GET'], '/html', null, () => {
            return orResponse().html('<h1>Hello</h1>');
        }));
        const response = await httpRequest(server, {
            path: '/html',
        });
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
        expect(response.body).toBe('<h1>Hello</h1>');
    });
    test('supports bulk headers and cookies helpers', async () => {
        const server = await createTestServer(orHandler(['GET'], '/bulk', null, () => {
            return orResponse()
                .headers({ 'X-One': '1', 'X-Two': '2' })
                .cookies({
                one: { value: '1' },
                two: { value: '2', maxAge: 10 },
            })
                .json({ ok: true });
        }));
        const response = await httpRequest(server, {
            path: '/bulk',
        });
        expect(response.headers['x-one']).toBe('1');
        expect(response.headers['x-two']).toBe('2');
        expect(response.headers['set-cookie']).toEqual([
            'one=1; Path=/; Max-Age=31536000; HttpOnly; Secure; Partitioned; SameSite=Lax',
            'two=2; Path=/; Max-Age=10; HttpOnly; Secure; Partitioned; SameSite=Lax',
        ]);
    });
});
describe('features: app options and error handling', () => {
    test('adds global response headers and cookies after handler execution', async () => {
        const app = orApp(orRouter('', [
            orHandler(['GET'], '/global', null, () => orResponse().json({ ok: true })),
        ]), {
            errorResponse: orResponse().status(500).json({ ok: false }),
            noHandlerResponse: () => orResponse().status(404).json({ ok: false }),
            addResponseHeaders: () => ({
                'X-App-Header': 'present',
            }),
            addResponseCookies: () => ({
                global: { value: 'yes' },
            }),
        });
        const server = await listenToApp(app);
        const response = await httpRequest(server, {
            path: '/global',
        });
        expect(response.status).toBe(200);
        expect(response.headers['x-app-header']).toBe('present');
        expect(response.headers['set-cookie']).toEqual([
            'global=yes; Path=/; Max-Age=31536000; HttpOnly; Secure; Partitioned; SameSite=Lax',
        ]);
        expect(JSON.parse(response.body)).toEqual({ ok: true });
    });
    test('supports async handlers, validations, and app hooks', async () => {
        const app = orApp(orRouter('', [
            orHandler(['POST'], '/async/:id', {
                body: z.object({ ok: z.literal(true) }),
                params: z.object({ id: z.string() }),
                failResponse: async () => orResponse().status(400).json({ ok: false }),
            }, async (req) => {
                return orResponse().json({
                    id: req.params.id,
                    ok: req.body.ok,
                });
            }),
        ]), {
            errorResponse: orResponse().status(500).json({ ok: false }),
            noHandlerResponse: async () => orResponse().status(404).json({ ok: false }),
            addResponseHeaders: async () => ({ 'X-Async': 'yes' }),
            addResponseCookies: async () => ({ async: { value: 'yes' } }),
        });
        const server = await listenToApp(app);
        const response = await httpRequest(server, {
            method: 'POST',
            path: '/async/abc',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ok: true }),
        });
        expect(response.status).toBe(200);
        expect(response.headers['x-async']).toBe('yes');
        expect(response.headers['set-cookie']).toEqual([
            'async=yes; Path=/; Max-Age=31536000; HttpOnly; Secure; Partitioned; SameSite=Lax',
        ]);
        expect(JSON.parse(response.body)).toEqual({
            id: 'abc',
            ok: true,
        });
    });
    test('uses errorResponseFunction for handler errors without leaking the thrown message', async () => {
        const app = orApp(orRouter('', [
            orHandler(['GET'], '/boom', null, () => {
                throw new Error('secret-internal-message');
            }),
        ]), {
            errorResponse: orResponse().status(500).json({ fallback: true }),
            noHandlerResponse: () => orResponse().status(404).json({ ok: false }),
            errorResponseFunction: (_req, error) => {
                expect(error).toBeInstanceOf(Error);
                return orResponse().status(503).json({ handled: true });
            },
        });
        const server = await listenToApp(app);
        const response = await httpRequest(server, {
            path: '/boom',
        });
        expect(response.status).toBe(503);
        expect(response.body).not.toContain('secret-internal-message');
        expect(JSON.parse(response.body)).toEqual({ handled: true });
    });
    test('falls back to errorResponse when addResponseHeaders throws', async () => {
        const app = orApp(orRouter('', [
            orHandler(['GET'], '/headers-fail', null, () => orResponse().json({ ok: true })),
        ]), {
            errorResponse: orResponse().status(500).json({ fallback: true }),
            noHandlerResponse: () => orResponse().status(404).json({ ok: false }),
            addResponseHeaders: () => {
                throw new Error('global-header-failed');
            },
        });
        const server = await listenToApp(app);
        const response = await httpRequest(server, {
            path: '/headers-fail',
        });
        expect(response.status).toBe(500);
        expect(response.body).not.toContain('global-header-failed');
        expect(JSON.parse(response.body)).toEqual({ fallback: true });
    });
    test('falls back to errorResponse when callbacks return invalid values', async () => {
        const invalidHandlerApp = orApp(orRouter('', [
            orHandler(['GET'], '/invalid-handler', null, () => ({ invalid: true })),
        ]), {
            errorResponse: orResponse().status(500).json({ fallback: true }),
            noHandlerResponse: () => orResponse().status(404).json({ ok: false }),
        });
        const invalidNoHandlerApp = orApp(orRouter('', []), {
            errorResponse: orResponse().status(500).json({ fallback: true }),
            noHandlerResponse: (() => ({ invalid: true })),
        });
        const invalidErrorFunctionApp = orApp(orRouter('', [
            orHandler(['GET'], '/throws', null, () => {
                throw new Error('boom');
            }),
        ]), {
            errorResponse: orResponse().status(500).json({ fallback: true }),
            noHandlerResponse: () => orResponse().status(404).json({ ok: false }),
            errorResponseFunction: (() => ({ invalid: true })),
        });
        const invalidFailResponseApp = orApp(orRouter('', [
            orHandler(['POST'], '/validation', {
                body: z.object({ ok: z.literal(true) }),
                failResponse: (() => ({ invalid: true })),
            }, () => orResponse().json({ ok: true })),
        ]), {
            errorResponse: orResponse().status(500).json({ fallback: true }),
            noHandlerResponse: () => orResponse().status(404).json({ ok: false }),
        });
        const invalidHandlerServer = await listenToApp(invalidHandlerApp);
        const invalidNoHandlerServer = await listenToApp(invalidNoHandlerApp);
        const invalidErrorFunctionServer = await listenToApp(invalidErrorFunctionApp);
        const invalidFailResponseServer = await listenToApp(invalidFailResponseApp);
        const responses = await Promise.all([
            httpRequest(invalidHandlerServer, { path: '/invalid-handler' }),
            httpRequest(invalidNoHandlerServer, { path: '/missing' }),
            httpRequest(invalidErrorFunctionServer, { path: '/throws' }),
            httpRequest(invalidFailResponseServer, {
                method: 'POST',
                path: '/validation',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ok: false }),
            }),
        ]);
        for (const response of responses) {
            expect(response.status).toBe(500);
            expect(JSON.parse(response.body)).toEqual({ fallback: true });
        }
    });
});
describe('edge cases: route definitions', () => {
    test('rejects invalid rest route definitions', () => {
        expect(() => orHandler(['GET'], '/files/*/tail', null, () => {
            return orResponse();
        })).toThrow('* path part must be last');
    });
    test('rejects empty and reserved param names', () => {
        expect(() => orHandler(['GET'], '/items/:', null, () => {
            return orResponse();
        })).toThrow('Param name cannot be empty');
        expect(() => orHandler(['GET'], '/items/:rest', null, () => {
            return orResponse();
        })).toThrow('Param name cannot be rest');
    });
    test('rejects duplicate and unsafe param names', () => {
        expect(() => orHandler(['GET'], '/items/:id/:id', null, () => {
            return orResponse();
        })).toThrow('Param id aoready exists');
        expect(() => orHandler(['GET'], '/items/:__proto__', null, () => {
            return orResponse();
        })).toThrow('Param name cannot be __proto__');
    });
    test('rejects response cookies with unsafe security attribute combinations', async () => {
        const server = await createTestServer(orHandler(['GET'], '/bad-cookie', null, () => {
            return orResponse()
                .cookie('bad', 'value', { sameSite: 'none', secure: false, partitioned: false })
                .json({ ok: true });
        }));
        const response = await httpRequest(server, {
            path: '/bad-cookie',
        });
        expect(response.status).toBe(500);
        expect(response.headers['set-cookie']).toBeUndefined();
        expect(JSON.parse(response.body)).toEqual({ ok: false });
    });
    test('rejects invalid response header values without leaking them', async () => {
        const server = await createTestServer(orHandler(['GET'], '/bad-header', null, () => {
            return orResponse()
                .header('X-Bad', 'safe\r\nInjected: bad')
                .json({ ok: true });
        }));
        const response = await httpRequest(server, {
            path: '/bad-header',
        });
        expect(response.status).toBe(500);
        expect(response.headers['x-bad']).toBeUndefined();
        expect(JSON.parse(response.body)).toEqual({ ok: false });
    });
});
describe('security: cookies', () => {
    test('parses safe percent-encoded request cookies as application values', async () => {
        const server = await createTestServer(orHandler(['GET'], '/cookies', null, req => {
            return orResponse().json({
                theme: req.cookies.theme ?? null,
            });
        }));
        const response = await httpRequest(server, {
            path: '/cookies',
            headers: {
                Cookie: 'theme=dark%20mode',
            },
        });
        expect(JSON.parse(response.body)).toEqual({ theme: 'dark mode' });
    });
    test('drops prototype-pollution and encoded-control request cookies', async () => {
        const server = await createTestServer(orHandler(['GET'], '/cookies', null, req => {
            return orResponse().json({
                proto: req.cookies.__proto__ ?? null,
                constructorCookie: req.cookies.constructor ?? null,
                prototypeCookie: req.cookies.prototype ?? null,
                unsafe: req.cookies.unsafe ?? null,
            });
        }));
        const response = await httpRequest(server, {
            path: '/cookies',
            headers: {
                Cookie: '__proto__=polluted; constructor=bad; prototype=bad; unsafe=%0d%0a',
            },
        });
        expect(JSON.parse(response.body)).toEqual({
            proto: null,
            constructorCookie: null,
            prototypeCookie: null,
            unsafe: null,
        });
    });
    test('encodes response cookie values and sends hardening attributes', async () => {
        const server = await createTestServer(orHandler(['GET'], '/set-cookie', null, () => {
            return orResponse()
                .cookie('session', 'a b;c=ok')
                .json({ ok: true });
        }));
        const response = await httpRequest(server, {
            path: '/set-cookie',
        });
        expect(response.headers['set-cookie']).toEqual([
            'session=a%20b%3Bc%3Dok; Path=/; Max-Age=31536000; HttpOnly; Secure; Partitioned; SameSite=Lax',
        ]);
    });
});
describe('security: request normalization', () => {
    test('drops prototype-pollution query keys before handlers receive the request', async () => {
        const server = await createTestServer(orHandler(['GET'], '/query', null, req => {
            return orResponse().json({
                proto: req.query.__proto__ ?? null,
                constructorQuery: req.query.constructor ?? null,
                prototypeQuery: req.query.prototype ?? null,
                safe: req.query.safe ?? null,
            });
        }));
        const response = await httpRequest(server, {
            path: '/query?__proto__=polluted&constructor=bad&prototype=bad&safe=yes',
        });
        expect(JSON.parse(response.body)).toEqual({
            proto: null,
            constructorQuery: null,
            prototypeQuery: null,
            safe: 'yes',
        });
    });
    test('decodes query values and uses the last value for duplicate query keys', async () => {
        const server = await createTestServer(orHandler(['GET'], '/query', null, req => {
            return orResponse().json({
                next: req.query.next ?? null,
                multi: req.query.multi ?? null,
                empty: req.query.empty ?? null,
            });
        }));
        const response = await httpRequest(server, {
            path: '/query?next=%2Fdashboard%3Ftab%3Dhome&multi=first&empty=&multi=second',
        });
        expect(JSON.parse(response.body)).toEqual({
            next: '/dashboard?tab=home',
            multi: 'second',
            empty: '',
        });
    });
    test('rejects unsupported HTTP methods before wildcard handlers run', async () => {
        let handlerReached = false;
        const server = await createTestServer(orHandler('*', '/method', null, () => {
            handlerReached = true;
            return orResponse().json({ reached: true });
        }));
        const response = await httpRequest(server, {
            method: 'TRACE',
            path: '/method',
        });
        expect(response.status).toBe(500);
        expect(handlerReached).toBe(false);
    });
});
describe('security: headers', () => {
    test('normalizes request header names and exposes Node-combined duplicate header values', async () => {
        const server = await createTestServer(orHandler(['GET'], '/headers', null, req => {
            return orResponse().json({
                token: req.headers['x-test-token'] ?? null,
            });
        }));
        const response = await httpRequest(server, {
            path: '/headers',
            headers: {
                'X-Test-Token': ['first', 'second'],
            },
        });
        expect(JSON.parse(response.body)).toEqual({
            token: 'first, second',
        });
    });
    test('drops prototype-pollution request header keys before handlers receive the request', async () => {
        const server = await createTestServer(orHandler(['GET'], '/headers', null, req => {
            return orResponse().json({
                proto: req.headers.__proto__ ?? null,
                constructorHeader: req.headers.constructor ?? null,
                prototypeHeader: req.headers.prototype ?? null,
                safe: req.headers['x-safe'] ?? null,
            });
        }));
        const response = await httpRequest(server, {
            path: '/headers',
            headers: {
                constructor: 'bad',
                prototype: 'bad',
                'X-Safe': 'yes',
            },
        });
        expect(JSON.parse(response.body)).toEqual({
            proto: null,
            constructorHeader: null,
            prototypeHeader: null,
            safe: 'yes',
        });
    });
    test('sends response headers before writing the response body', async () => {
        const server = await createTestServer(orHandler(['GET'], '/headers', null, () => {
            return orResponse()
                .header('X-Security-Test', 'present')
                .json({ ok: true });
        }));
        const response = await httpRequest(server, {
            path: '/headers',
        });
        expect(response.status).toBe(200);
        expect(response.headers['x-security-test']).toBe('present');
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(JSON.parse(response.body)).toEqual({ ok: true });
    });
});
describe('security: path normalization and route matching', () => {
    test('normalizes a trailing slash to the same route', async () => {
        const server = await createTestServer(orHandler(['GET'], '/admin', null, req => {
            return orResponse().json({
                path: req.path,
            });
        }));
        const response = await httpRequest(server, {
            path: '/admin/',
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ path: '/admin' });
    });
    test('does not collapse repeated slashes into a protected route', async () => {
        let handlerReached = false;
        const server = await createTestServer(orHandler(['GET'], '/admin', null, () => {
            handlerReached = true;
            return orResponse().json({ reached: true });
        }));
        const response = await rawHttpRequest(server, [
            'GET //admin HTTP/1.1',
            'Host: localhost',
            'Connection: close',
            '',
            '',
        ].join('\r\n'));
        expect(response.status).toBe(500);
        expect(handlerReached).toBe(false);
        expect(JSON.parse(response.body)).toEqual({ ok: false });
    });
    test('does not match encoded traversal after URL parsing normalizes it', async () => {
        const server = await createTestServer(orHandler(['GET'], '/files/:name', null, () => {
            return orResponse().json({ reached: true });
        }));
        const response = await httpRequest(server, {
            path: '/files/%2e%2e',
        });
        expect(response.status).toBe(404);
        expect(JSON.parse(response.body)).toEqual({ ok: false });
    });
    test('keeps encoded backslash bytes as route data', async () => {
        const server = await createTestServer(orHandler(['GET'], '/files/:name', null, req => {
            const params = req.params;
            return orResponse().json({
                name: params.name ?? null,
            });
        }));
        const response = await httpRequest(server, {
            path: '/files/a%5cb',
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ name: 'a%5cb' });
    });
    test('does not let encoded literal paths bypass exact route matching', async () => {
        const server = await createTestServer(orHandler(['GET'], '/admin', null, () => {
            return orResponse().json({ reached: true });
        }));
        const response = await httpRequest(server, {
            path: '/%61dmin',
        });
        expect(response.status).toBe(404);
        expect(JSON.parse(response.body)).toEqual({ ok: false });
    });
    test('does not match extra path segments without an explicit rest route', async () => {
        const server = await createTestServer(orHandler(['GET'], '/admin', null, () => {
            return orResponse().json({ reached: true });
        }));
        const response = await httpRequest(server, {
            path: '/admin/..',
        });
        expect(response.status).toBe(404);
        expect(JSON.parse(response.body)).toEqual({ ok: false });
    });
    test('captures encoded slashes as param data instead of path separators', async () => {
        const server = await createTestServer(orHandler(['GET'], '/files/:name', null, req => {
            const params = req.params;
            return orResponse().json({
                name: params.name ?? null,
            });
        }));
        const response = await httpRequest(server, {
            path: '/files/a%2Fb',
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ name: 'a%2Fb' });
    });
    test('only explicit rest routes match additional path segments', async () => {
        const server = await createTestServer([
            orHandler(['GET'], '/files/:name', null, () => {
                return orResponse().json({ type: 'single' });
            }),
            orHandler(['GET'], '/files/*', null, req => {
                const params = req.params;
                return orResponse().json({
                    type: 'rest',
                    rest: params['*'] ?? null,
                });
            }),
        ]);
        const response = await httpRequest(server, {
            path: '/files/a/b',
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
            type: 'rest',
            rest: 'a/b',
        });
    });
    test('does not match a param route when the segment is empty due to a double slash', async () => {
        let handlerReached = false;
        const server = await createTestServer(orHandler(['GET'], '/abc/:id/foo', null, () => {
            handlerReached = true;
            return orResponse().json({ reached: true });
        }));
        const response = await httpRequest(server, {
            path: '/abc//foo',
        });
        expect(response.status).toBe(404);
        expect(handlerReached).toBe(false);
    });
    test('matches a rest route when there are zero remaining segments', async () => {
        const server = await createTestServer(orHandler(['GET'], '/abc/*', null, (req) => {
            const params = req.params;
            return orResponse().json({
                rest: params['*'] ?? null,
            });
        }));
        const response = await httpRequest(server, {
            path: '/abc',
        });
        expect(response.status).toBe(200);
    });
});
describe('security: body parsing', () => {
    test('invalid JSON fails closed before the handler runs', async () => {
        let handlerReached = false;
        const server = await createTestServer(orHandler(['POST'], '/json', null, () => {
            handlerReached = true;
            return orResponse().json({ reached: true });
        }));
        const response = await httpRequest(server, {
            method: 'POST',
            path: '/json',
            headers: {
                'Content-Type': 'application/json',
            },
            body: '{"broken":',
        });
        expect(response.status).toBe(500);
        expect(handlerReached).toBe(false);
        expect(JSON.parse(response.body)).toEqual({ ok: false });
    });
    test('empty JSON bodies fail closed before the handler runs', async () => {
        let handlerReached = false;
        const server = await createTestServer(orHandler(['POST'], '/json-empty', null, () => {
            handlerReached = true;
            return orResponse().json({ reached: true });
        }));
        const response = await httpRequest(server, {
            method: 'POST',
            path: '/json-empty',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        expect(response.status).toBe(500);
        expect(handlerReached).toBe(false);
        expect(JSON.parse(response.body)).toEqual({ ok: false });
    });
    describe('exported functions: invalid argument handling', () => {
        describe('orHandler', () => {
            test('throws when methods is not an array or valid method string', () => {
                expect(() => orHandler(123, '/path', null, (() => { }))).toThrow();
                expect(() => orHandler({}, '/path', null, (() => { }))).toThrow();
                expect(() => orHandler(null, '/path', null, (() => { }))).toThrow();
            });
            test('throws when path is not a string', () => {
                expect(() => orHandler(['GET'], 123, null, (() => { }))).toThrow();
                expect(() => orHandler(['GET'], {}, null, (() => { }))).toThrow();
                expect(() => orHandler(['GET'], null, null, (() => { }))).toThrow();
            });
            test('throws when handler is not a function', () => {
                expect(() => orHandler(['GET'], '/path', null, 'not a function')).toThrow();
                expect(() => orHandler(['GET'], '/path', null, 123)).toThrow();
                expect(() => orHandler(['GET'], '/path', null, {})).toThrow();
            });
            test('throws when validations is invalid type', () => {
                expect(() => orHandler(['GET'], '/path', 'invalid', (() => { }))).toThrow();
                expect(() => orHandler(['GET'], '/path', 123, (() => { }))).toThrow();
            });
        });
        describe('orRouter', () => {
            test('throws when prefix is not a string', () => {
                expect(() => orRouter(123, [])).toThrow();
                expect(() => orRouter({}, [])).toThrow();
                expect(() => orRouter(null, [])).toThrow();
            });
            test('throws when handlers is not an array', () => {
                expect(() => orRouter('', 'not array')).toThrow();
                expect(() => orRouter('', 123)).toThrow();
                expect(() => orRouter('', null)).toThrow();
            });
            test('throws when handlers array contains invalid items', () => {
                expect(() => orRouter('', [123])).toThrow();
                expect(() => orRouter('', ['invalid'])).toThrow();
            });
        });
        describe('orApp', () => {
            test('throws when router is not a valid orRouter instance', () => {
                const fakeRouter = { execute: () => { } };
                expect(() => orApp(fakeRouter, {
                    errorResponse: orResponse().status(500).json({}),
                    noHandlerResponse: () => orResponse().status(404).json({}),
                })).toThrow();
                expect(() => orApp(null, {
                    errorResponse: orResponse().status(500).json({}),
                    noHandlerResponse: () => orResponse().status(404).json({}),
                })).toThrow();
            });
            test('throws when options is not an object', () => {
                const router = orRouter('', []);
                expect(() => orApp(router, 123)).toThrow();
                expect(() => orApp(router, 'invalid')).toThrow();
                expect(() => orApp(router, null)).toThrow();
            });
        });
    });
    test('multipart bodies drop prototype-pollution field and file names', async () => {
        const boundary = 'oscar-router-pollution-boundary';
        const server = await createTestServer(orHandler(['POST'], '/multipart-pollution', null, req => {
            return orResponse().json({
                safeField: req.body.safe,
                protoField: req.body.__proto__ ?? null,
                constructorField: req.body.constructor ?? null,
                safeFile: req.files?.upload?.name ?? null,
                protoFile: req.files?.__proto__ ?? null,
                constructorFile: req.files?.constructor ?? null,
            });
        }));
        const response = await httpRequest(server, {
            method: 'POST',
            path: '/multipart-pollution',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
            },
            body: multipartBody(boundary, [
                { name: 'safe', value: 'yes' },
                { name: '__proto__', value: 'polluted' },
                { name: 'constructor', value: 'bad' },
                { name: 'upload', filename: 'safe.txt', contentType: 'text/plain', value: 'safe' },
                { name: '__proto__', filename: 'bad.txt', contentType: 'text/plain', value: 'bad' },
                { name: 'constructor', filename: 'bad.txt', contentType: 'text/plain', value: 'bad' },
            ]),
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
            safeField: 'yes',
            protoField: null,
            constructorField: null,
            safeFile: 'safe.txt',
            protoFile: null,
            constructorFile: null,
        });
    });
    test('files object on request drops prototype-pollution keys and uses null prototype', async () => {
        const boundary = 'oscar-router-files-pollution-boundary';
        let capturedFiles = undefined;
        const server = await createTestServer(orHandler(['POST'], '/multipart-files-pp', null, req => {
            capturedFiles = req.files;
            return orResponse().json({
                uploadName: capturedFiles?.upload?.name ?? null,
                uploadType: capturedFiles?.upload?.mimeType ?? null,
                protoFile: capturedFiles?.__proto__ ?? null,
                constructorFile: capturedFiles?.constructor ?? null,
                prototypeFile: capturedFiles?.prototype ?? null,
            });
        }));
        const response = await httpRequest(server, {
            method: 'POST',
            path: '/multipart-files-pp',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
            },
            body: multipartBody(boundary, [
                { name: 'upload', filename: 'photo.png', contentType: 'image/png', value: 'fake-png-data' },
                { name: '__proto__', filename: 'bad.txt', contentType: 'text/plain', value: 'polluted' },
                { name: 'constructor', filename: 'bad.txt', contentType: 'text/plain', value: 'bad' },
                { name: 'prototype', filename: 'bad.txt', contentType: 'text/plain', value: 'bad' },
            ]),
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
            uploadName: 'photo.png',
            uploadType: 'image/png',
            protoFile: null,
            constructorFile: null,
            prototypeFile: null,
        });
        expect(capturedFiles).toBeDefined();
        expect(Object.getPrototypeOf(capturedFiles)).toBeNull();
    });
    test('urlencoded bodies parse into a null-prototype object and drop inherited pollution behavior', async () => {
        const server = await createTestServer(orHandler(['POST'], '/form', null, req => {
            const body = req.body;
            return orResponse().json({
                safe: body.safe ?? null,
                proto: body.__proto__ ?? null,
                prototype: body.prototype ?? null,
                constructorValue: body.constructor ?? null,
            });
        }));
        const response = await httpRequest(server, {
            method: 'POST',
            path: '/form',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: '__proto__=polluted&prototype=bad&constructor=bad&safe=yes',
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
            safe: 'yes',
            proto: null,
            prototype: null,
            constructorValue: null,
        });
    });
});
describe('more coverage: route matching internals and request state', () => {
    test('exposes public match results for matching and non-matching routes', () => {
        const router = orRouter('', [
            orHandler(['GET'], '/users/:id', null, () => orResponse()),
            orHandler(['POST'], '/users', null, () => orResponse()),
        ]);
        const getMatch = router.match('GET', '/users/123');
        const postMatch = router.match('POST', '/users/123');
        expect(getMatch.matches.length).toBe(1);
        expect(getMatch.matches[0].type).toBe('handler');
        expect(postMatch.matches.length).toBe(0);
    });
    test('shares req.data across orNext fallthrough handlers', async () => {
        const server = await createTestServer([
            orHandler(['GET'], '/state', null, req => {
                req.data.user = 'oscar';
                return orNext;
            }),
            orHandler(['GET'], '/state', null, req => {
                return orResponse().json({
                    user: req.data.user ?? null,
                });
            }),
        ]);
        const response = await httpRequest(server, {
            path: '/state',
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ user: 'oscar' });
    });
    test('keeps query, headers, and cookies on direct app execution', async () => {
        const app = orApp(orRouter('', [
            orHandler(['GET'], '/direct-context', null, (req) => {
                return orResponse().json({
                    query: req.query.safe,
                    header: req.headers['x-test'],
                    cookie: req.cookies.session,
                    ip: req.ip,
                });
            }),
        ]), {
            errorResponse: orResponse().status(500).json({ ok: false }),
            noHandlerResponse: () => orResponse().status(404).json({ ok: false }),
        });
        const response = await app.execute({
            method: 'GET',
            isHead: false,
            path: '/direct-context',
            url: '/direct-context?safe=yes',
            params: null,
            query: { safe: 'yes' },
            body: null,
            files: Object.create(null),
            data: Object.create(null),
            ip: '203.0.113.10',
            headers: { 'x-test': 'present' },
            cookies: { session: 'abc' },
        });
        expect(response.status).toBe(200);
        expect(response.body.body).toEqual({
            query: 'yes',
            header: 'present',
            cookie: 'abc',
            ip: '203.0.113.10',
        });
    });
});
describe('more coverage: URL and query edge cases', () => {
    test('does not route absolute-form request targets to protected routes', async () => {
        let handlerReached = false;
        const server = await createTestServer(orHandler(['GET'], '/admin', null, () => {
            handlerReached = true;
            return orResponse().json({ reached: true });
        }));
        const response = await rawHttpRequest(server, [
            'GET http://localhost/admin HTTP/1.1',
            'Host: localhost',
            'Connection: close',
            '',
            '',
        ].join('\r\n'));
        expect(response.status).toBe(404);
        expect(handlerReached).toBe(false);
        expect(JSON.parse(response.body)).toEqual({ ok: false });
    });
    test('decodes plus signs in query values as spaces', async () => {
        const server = await createTestServer(orHandler(['GET'], '/search', null, req => {
            return orResponse().json({
                q: req.query.q ?? null,
            });
        }));
        const response = await httpRequest(server, {
            path: '/search?q=league+fm',
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ q: 'league fm' });
    });
    test('keeps blank query keys as explicit data', async () => {
        const server = await createTestServer(orHandler(['GET'], '/blank-query', null, req => {
            return orResponse().json({
                blank: req.query[''] ?? null,
                safe: req.query.safe ?? null,
            });
        }));
        const response = await httpRequest(server, {
            path: '/blank-query?=blank&safe=yes',
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
            blank: 'blank',
            safe: 'yes',
        });
    });
    test('treats semicolons in query as part of the value, not as separators', async () => {
        const server = await createTestServer(orHandler(['GET'], '/query-semicolon', null, req => {
            return orResponse().json({
                value: req.query.a ?? null,
                b: req.query.b ?? null,
            });
        }));
        const response = await httpRequest(server, {
            path: '/query-semicolon?a=1;b=2',
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
            value: '1;b=2',
            b: null,
        });
    });
});
describe('more coverage: cookie edge cases', () => {
    test('drops invalid request cookie names and raw invalid values', async () => {
        const server = await createTestServer(orHandler(['GET'], '/cookie-edge', null, req => {
            return orResponse().json({
                valid: req.cookies.valid ?? null,
                spacedName: req.cookies['bad name'] ?? null,
                rawSpace: req.cookies.rawspace ?? null,
            });
        }));
        const response = await httpRequest(server, {
            path: '/cookie-edge',
            headers: {
                Cookie: 'valid=yes; bad name=no; rawspace=hello world',
            },
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
            valid: 'yes',
            spacedName: null,
            rawSpace: null,
        });
    });
    test('keeps malformed percent-encoded cookie values as raw safe data', async () => {
        const server = await createTestServer(orHandler(['GET'], '/cookie-malformed', null, req => {
            return orResponse().json({
                malformed: req.cookies.malformed ?? null,
            });
        }));
        const response = await httpRequest(server, {
            path: '/cookie-malformed',
            headers: {
                Cookie: 'malformed=%E0%A4%A',
            },
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
            malformed: '%E0%A4%A',
        });
    });
    test('uses the last duplicate request cookie value', async () => {
        const server = await createTestServer(orHandler(['GET'], '/cookie-duplicates', null, req => {
            return orResponse().json({
                session: req.cookies.session ?? null,
            });
        }));
        const response = await httpRequest(server, {
            path: '/cookie-duplicates',
            headers: {
                Cookie: 'session=first; session=second',
            },
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ session: 'second' });
    });
    test('rejects invalid response cookie name, path, domain, maxAge, and partitioned options', async () => {
        const cases = [
            {
                path: '/bad-cookie-name',
                response: () => orResponse().cookie('bad name', 'value').json({ ok: true }),
            },
            {
                path: '/bad-cookie-path',
                response: () => orResponse().cookie('good', 'value', { path: '/safe;bad' }).json({ ok: true }),
            },
            {
                path: '/bad-cookie-domain',
                response: () => orResponse().cookie('good', 'value', { domain: '-bad.example' }).json({ ok: true }),
            },
            {
                path: '/bad-cookie-max-age',
                response: () => orResponse().cookie('good', 'value', { maxAge: -1 }).json({ ok: true }),
            },
            {
                path: '/bad-cookie-partitioned',
                response: () => orResponse().cookie('good', 'value', { secure: false, partitioned: true }).json({ ok: true }),
            },
        ];
        const server = await createTestServer(cases.map(({ path, response }) => {
            return orHandler(['GET'], path, null, response);
        }));
        for (const testCase of cases) {
            const response = await httpRequest(server, {
                path: testCase.path,
            });
            expect(response.status).toBe(500);
            expect(response.headers['set-cookie']).toBeUndefined();
            expect(JSON.parse(response.body)).toEqual({ ok: false });
        }
    });
});
describe('more coverage: response status and redirect edge cases', () => {
    test('supports unknown but valid status codes with an empty default reason phrase', async () => {
        const server = await createTestServer(orHandler(['GET'], '/status-299', null, () => {
            return orResponse().status(299).text('custom');
        }));
        const response = await httpRequest(server, {
            path: '/status-299',
        });
        expect(response.status).toBe(299);
        expect(response.body).toBe('custom');
    });
    test('rejects invalid status codes through the fallback error response', async () => {
        const server = await createTestServer(orHandler(['GET'], '/status-invalid', null, () => {
            return orResponse().status(99).text('invalid');
        }));
        const response = await httpRequest(server, {
            path: '/status-invalid',
        });
        expect(response.status).toBe(500);
        expect(JSON.parse(response.body)).toEqual({ ok: false });
    });
    test('rejects redirect locations containing header-breaking characters', async () => {
        const server = await createTestServer(orHandler(['GET'], '/bad-redirect', null, () => {
            return orResponse().redirect('/safe\r\nX-Bad: yes');
        }));
        const response = await httpRequest(server, {
            path: '/bad-redirect',
        });
        expect(response.status).toBe(500);
        expect(response.headers.location).toBeUndefined();
        expect(JSON.parse(response.body)).toEqual({ ok: false });
    });
});
describe('stress and limits', () => {
    test('handles many concurrent small requests without cross-request state leakage', async () => {
        const server = await createTestServer(orHandler(['GET'], '/parallel/:id', null, req => {
            const params = req.params;
            req.data.id = params.id ?? '';
            return orResponse().json({
                id: req.data.id ?? null,
            });
        }));
        const responses = await Promise.all(Array.from({ length: 40 }, async (_, index) => {
            return httpRequest(server, {
                path: `/parallel/${index}`,
            });
        }));
        expect(responses.length).toBe(40);
        for (let i = 0; i < responses.length; i++) {
            expect(responses[i].status).toBe(200);
            expect(JSON.parse(responses[i].body)).toEqual({ id: String(i) });
        }
    });
    test('allows a delayed handler to complete normally', async () => {
        const server = await createTestServer(orHandler(['GET'], '/slow-handler', null, async () => {
            await new Promise(resolve => setTimeout(resolve, 150));
            return orResponse().json({ ok: true });
        }));
        const startedAt = Date.now();
        const response = await httpRequest(server, {
            path: '/slow-handler',
        });
        expect(Date.now() - startedAt).toBeGreaterThanOrEqual(100);
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ ok: true });
    });
    test('closes slow incomplete requests using the server timeout', async () => {
        let handlerReached = false;
        const server = await createTestServer(orHandler(['POST'], '/slow-body', null, () => {
            handlerReached = true;
            return orResponse().json({ reached: true });
        }));
        server.setTimeout(100);
        const result = await rawIdleRequest(server, [
            'POST /slow-body HTTP/1.1',
            'Host: localhost',
            'Content-Type: application/json',
            'Content-Length: 20',
            'Connection: close',
            '',
            '{"not-finished":',
        ].join('\r\n'));
        expect(result.closedAfterMs).toBeLessThan(5000);
        expect(handlerReached).toBe(false);
    });
    test('rejects oversized JSON bodies before the handler runs', async () => {
        let handlerReached = false;
        const server = await createTestServer(orHandler(['POST'], '/oversized-json', null, () => {
            handlerReached = true;
            return orResponse().json({ reached: true });
        }));
        const response = await largeJsonRequest(server, '/oversized-json', 92);
        expect(response.bytesAttempted).toBeGreaterThan(90 * 1024 * 1024);
        expect(handlerReached).toBe(false);
        if (response.status !== undefined) {
            expect(response.status).toBe(500);
            expect(JSON.parse(response.body)).toEqual({ ok: false });
        }
        else {
            expect(response.errorCode).toBeDefined();
        }
    });
    test('parses a large multipart file that remains below configured limits', async () => {
        const boundary = 'oscar-router-large-file-boundary';
        const largeFile = 'x'.repeat(2 * 1024 * 1024);
        const server = await createTestServer(orHandler(['POST'], '/large-file', null, req => {
            return orResponse().json({
                name: req.files.upload?.name ?? null,
                mimeType: req.files.upload?.mimeType ?? null,
                size: req.files.upload?.buffer.length ?? null,
            });
        }));
        const response = await httpRequest(server, {
            method: 'POST',
            path: '/large-file',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
            },
            body: multipartBody(boundary, [
                { name: 'upload', filename: 'large.txt', contentType: 'text/plain', value: largeFile },
            ]),
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
            name: 'large.txt',
            mimeType: 'text/plain',
            size: largeFile.length,
        });
    });
    test('enforces multipart field and file count limits', async () => {
        const boundary = 'oscar-router-count-limit-boundary';
        const parts = [
            ...Array.from({ length: 105 }, (_, index) => ({
                name: `field${index}`,
                value: String(index),
            })),
            ...Array.from({ length: 12 }, (_, index) => ({
                name: 'upload',
                filename: `file${index}.txt`,
                contentType: 'text/plain',
                value: `file-${index}`,
            })),
        ];
        const server = await createTestServer(orHandler(['POST'], '/multipart-counts', null, req => {
            return orResponse().json({
                fieldCount: Object.keys(req.body).length,
                hasField99: req.body.field99,
                hasField100: req.body.field100 ?? null,
                fileCount: req.files.upload ? 1 : 0,
            });
        }));
        const response = await httpRequest(server, {
            method: 'POST',
            path: '/multipart-counts',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
            },
            body: multipartBody(boundary, parts),
        });
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
            fieldCount: 100,
            hasField99: '99',
            hasField100: null,
            fileCount: 1,
        });
    });
});
