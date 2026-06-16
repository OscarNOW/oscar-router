// © 2026 Oscar Knap - Alle rechten voorbehouden
export const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
const defaultStatusMessages = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    307: 'Temporary Redirect',
    308: 'Permanent Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    410: 'Gone',
    413: 'Content Too Large',
    415: 'Unsupported Media Type',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    503: 'Service Unavailable',
};
export const defaultResponseCookieOptions = {
    httpOnly: true,
    secure: true,
    partitioned: true,
    sameSite: 'lax',
    path: '/',
    domain: '',
    /** 60 * 60 * 24 * 365 */
    maxAge: 31536000,
};
export class LrResponse {
    response;
    constructor(response) {
        this.response = response;
    }
    status(status, statusMessage) {
        return new LrResponse({
            ...this.response,
            status,
            statusMessage: statusMessage ?? defaultStatusMessages[status] ?? '',
        });
    }
    header(key, value) {
        return new LrResponse({
            ...this.response,
            headers: {
                ...this.response.headers,
                [key]: value,
            }
        });
    }
    headers(headers) {
        return new LrResponse({
            ...this.response,
            headers: {
                ...this.response.headers,
                ...headers,
            }
        });
    }
    json(data) {
        return new LrResponse({
            ...this.response,
            headers: {
                ...this.response.headers,
                'Content-Type': 'application/json; charset=utf-8',
            },
            body: {
                type: 'json',
                body: data
            }
        });
    }
    text(text) {
        return new LrResponse({
            ...this.response,
            headers: {
                ...this.response.headers,
                'Content-Type': 'text/plain; charset=utf-8',
            },
            body: {
                type: 'text',
                body: text
            }
        });
    }
    html(html) {
        return new LrResponse({
            ...this.response,
            headers: {
                ...this.response.headers,
                'Content-Type': 'text/html; charset=utf-8',
            },
            body: {
                type: 'text',
                body: html
            }
        });
    }
    buffer(buffer) {
        return new LrResponse({
            ...this.response,
            headers: {
                ...this.response.headers,
                'Content-Type': 'application/octet-stream',
            },
            body: {
                type: 'buffer',
                body: buffer
            }
        });
    }
    type(type) {
        return new LrResponse({
            ...this.response,
            headers: {
                ...this.response.headers,
                'Content-Type': type,
            }
        });
    }
    redirect(url) {
        return new LrResponse({
            ...this.response,
            status: 307,
            statusMessage: defaultStatusMessages[307],
            headers: {
                ...this.response.headers,
                'Location': url,
                'Content-Type': 'text/plain; charset=utf-8',
            },
            body: {
                type: 'text',
                body: ''
            }
        });
    }
    permanentRedirect(url) {
        return new LrResponse({
            ...this.response,
            status: 308,
            statusMessage: defaultStatusMessages[308],
            headers: {
                ...this.response.headers,
                'Location': url,
                'Content-Type': 'text/plain; charset=utf-8',
            },
            body: {
                type: 'text',
                body: ''
            }
        });
    }
    cookie(name, value, options) {
        return new LrResponse({
            ...this.response,
            cookies: {
                ...this.response.cookies,
                [name]: {
                    value,
                    options: options ? {
                        ...defaultResponseCookieOptions,
                        ...options,
                    } : defaultResponseCookieOptions
                },
            }
        });
    }
    cookies(cookies) {
        let newCookies = Object.create(null);
        for (const [name, { value, ...options }] of Object.entries(cookies)) {
            newCookies[name] = {
                value,
                options: {
                    ...defaultResponseCookieOptions,
                    ...options,
                }
            };
        }
        return new LrResponse({
            ...this.response,
            cookies: {
                ...this.response.cookies,
                ...newCookies
            }
        });
    }
}
export function orResponse() {
    return new LrResponse({
        status: 200,
        statusMessage: defaultStatusMessages[200],
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
        },
        body: {
            type: 'text',
            body: ''
        },
        cookies: Object.create(null)
    });
}
