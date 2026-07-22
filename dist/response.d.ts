import type { simplify } from './types.ts';
export declare const httpMethods: readonly ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"];
export type httpMethod = typeof httpMethods[number];
type jsonStringifyable = number | string | null | boolean | jsonStringifyable[] | {
    [key: string]: jsonStringifyable;
};
declare const defaultStatusMessages: {
    readonly 200: "OK";
    readonly 201: "Created";
    readonly 204: "No Content";
    readonly 307: "Temporary Redirect";
    readonly 308: "Permanent Redirect";
    readonly 400: "Bad Request";
    readonly 401: "Unauthorized";
    readonly 403: "Forbidden";
    readonly 404: "Not Found";
    readonly 405: "Method Not Allowed";
    readonly 410: "Gone";
    readonly 413: "Content Too Large";
    readonly 415: "Unsupported Media Type";
    readonly 429: "Too Many Requests";
    readonly 500: "Internal Server Error";
    readonly 501: "Not Implemented";
    readonly 503: "Service Unavailable";
};
type responseBody = {
    type: 'json';
    body: jsonStringifyable;
} | {
    type: 'text';
    body: string;
} | {
    type: 'buffer';
    body: Buffer;
};
export type responseCookieOptions = {
    httpOnly: boolean;
    secure: boolean;
    partitioned: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    path: string;
    domain: string;
    maxAge: number;
};
export declare const defaultResponseCookieOptions: {
    readonly httpOnly: true;
    readonly secure: true;
    readonly partitioned: true;
    readonly sameSite: "lax";
    readonly path: "/";
    readonly domain: "";
    /** 60 * 60 * 24 * 365 */
    readonly maxAge: 31536000;
};
type responseCookie = {
    value: string;
    options: responseCookieOptions;
};
export type responseWithHeaders<response extends orResponseObject, headers extends Record<string, string>> = simplify<Omit<response, 'headers'> & {
    headers: simplify<Omit<response['headers'], keyof headers> & headers>;
}>;
export type responseWithCookies<response extends orResponseObject, cookies extends Record<string, {
    value: string;
} & Partial<responseCookieOptions>>> = simplify<Omit<response, 'cookies'> & {
    cookies: simplify<Omit<response['cookies'], keyof cookies> & {
        [K in keyof cookies]: {
            value: cookies[K]['value'];
            options: simplify<Omit<Omit<cookies[K], 'value'>, Exclude<keyof Omit<cookies[K], 'value'>, keyof responseCookieOptions>> & Omit<typeof defaultResponseCookieOptions, keyof Omit<cookies[K], 'value'>>>;
        };
    }>;
}>;
export type orResponseObject = {
    status: number;
    statusMessage: string;
    body: responseBody;
    headers: Record<string, string>;
    cookies: Record<string, responseCookie>;
};
export declare class LrResponse<const response extends orResponseObject> {
    response: response;
    constructor(response: response);
    status<const status extends number, const statusMessage extends string | undefined = undefined>(status: status, statusMessage?: statusMessage): LrResponse<simplify<{
        status: status;
        statusMessage: statusMessage extends undefined ? (status extends keyof typeof defaultStatusMessages ? (typeof defaultStatusMessages)[status] : '') : statusMessage;
    } & Omit<response, 'status' | 'statusMessage'>>>;
    header<const key extends string, const value extends string>(key: key, value: value): LrResponse<simplify<Omit<response, 'headers'> & {
        headers: simplify<Omit<response['headers'], key> & {
            [x in key]: value;
        }>;
    }>>;
    headers<const headers extends Record<string, string>>(headers: headers): LrResponse<responseWithHeaders<response, headers>>;
    json<const data extends jsonStringifyable>(data: data): LrResponse<simplify<Omit<response, 'headers' | 'body'> & {
        headers: simplify<Omit<response['headers'], 'Content-Type'> & {
            'Content-Type': 'application/json; charset=utf-8';
        }>;
        body: {
            type: 'json';
            body: data;
        };
    }>>;
    text<const text extends string>(text: text): LrResponse<simplify<Omit<response, 'headers' | 'body'> & {
        headers: simplify<Omit<response['headers'], 'Content-Type'> & {
            'Content-Type': 'text/plain; charset=utf-8';
        }>;
        body: {
            type: 'text';
            body: text;
        };
    }>>;
    html<const html extends string>(html: html): LrResponse<simplify<Omit<response, 'headers' | 'body'> & {
        headers: simplify<Omit<response['headers'], 'Content-Type'> & {
            'Content-Type': 'text/html; charset=utf-8';
        }>;
        body: {
            type: 'text';
            body: html;
        };
    }>>;
    buffer<const buffer extends Buffer>(buffer: buffer): LrResponse<simplify<Omit<response, 'headers' | 'body'> & {
        headers: simplify<Omit<response['headers'], 'Content-Type'> & {
            'Content-Type': 'application/octet-stream';
        }>;
        body: {
            type: 'buffer';
            body: buffer;
        };
    }>>;
    type<const type extends string>(type: type): LrResponse<simplify<Omit<response, 'headers'> & {
        headers: simplify<Omit<response['headers'], 'Content-Type'> & {
            'Content-Type': type;
        }>;
    }>>;
    redirect<const url extends string>(url: url): LrResponse<simplify<{
        status: 307;
        statusMessage: (typeof defaultStatusMessages)[307];
        headers: simplify<Omit<response['headers'], 'Location' | 'Content-Type'> & {
            'Location': url;
            'Content-Type': 'text/plain; charset=utf-8';
        }>;
        body: {
            type: 'text';
            body: '';
        };
    } & Omit<response, 'status' | 'statusMessage' | 'headers' | 'body'>>>;
    permanentRedirect<const url extends string>(url: url): LrResponse<simplify<{
        status: 308;
        statusMessage: (typeof defaultStatusMessages)[308];
        headers: simplify<Omit<response['headers'], 'Location' | 'Content-Type'> & {
            'Location': url;
            'Content-Type': 'text/plain; charset=utf-8';
        }>;
        body: {
            type: 'text';
            body: '';
        };
    } & Omit<response, 'status' | 'statusMessage' | 'headers' | 'body'>>>;
    cookie<const name extends string, const value extends string, const options extends Partial<responseCookieOptions> | undefined = undefined>(name: name, value: value, options?: options): LrResponse<simplify<Omit<response, 'cookie'> & {
        cookies: simplify<Omit<response['cookies'], name> & {
            [key in name]: {
                value: value;
                options: options extends undefined ? typeof defaultResponseCookieOptions : simplify<Omit<options, Exclude<keyof options, keyof responseCookieOptions>> & Omit<typeof defaultResponseCookieOptions, keyof options>>;
            };
        }>;
    }>>;
    cookies<const cookies extends Record<string, {
        value: string;
    } & Partial<responseCookieOptions>>>(cookies: cookies): LrResponse<responseWithCookies<response, cookies>>;
}
export declare function orResponse(): LrResponse<{
    readonly status: 200;
    readonly statusMessage: "OK";
    readonly headers: {
        readonly 'Content-Type': "text/plain; charset=utf-8";
    };
    readonly body: {
        readonly type: "text";
        readonly body: "";
    };
    readonly cookies: {};
}>;
export {};
//# sourceMappingURL=response.d.ts.map