import type { IncomingMessage, ServerResponse } from "node:http";
import type { orRequest } from "./types";
import type { orResponseObject, httpMethod } from "./response";
import z from "zod";
export declare const orFileSchema: z.ZodObject<{
    name: z.ZodString;
    mimeType: z.ZodString;
    buffer: z.ZodCustom<Buffer<ArrayBufferLike>, Buffer<ArrayBufferLike>>;
}, z.core.$strip>;
export type file = z.infer<typeof orFileSchema>;
type generalRequest = orRequest<httpMethod, `/${string}`>;
export declare function transformNodeRequest(nodeReq: IncomingMessage): Promise<generalRequest>;
export declare function sendNodeResponse(nodeReq: IncomingMessage, nodeRes: ServerResponse, response: orResponseObject): Promise<void>;
export {};
//# sourceMappingURL=node.d.ts.map