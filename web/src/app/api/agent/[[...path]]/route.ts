import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
    params: Promise<{ path?: string[] }>;
};

function resolveOrigin(request: NextRequest): string {
    const rawOrigin = request.headers.get("origin");
    if (rawOrigin && rawOrigin !== "null") return rawOrigin;

    const forwardedProto = request.headers.get("x-forwarded-proto");
    const forwardedHost = request.headers.get("x-forwarded-host");
    if (forwardedHost) {
        const proto = forwardedProto || "https";
        return `${proto}://${forwardedHost}`;
    }

    const host = request.headers.get("host");
    if (host) {
        const proto = forwardedProto || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
        return `${proto}://${host}`;
    }

    return request.nextUrl.origin;
}

async function proxy(request: NextRequest, context: RouteContext) {
    const { path } = await context.params;
    const agentPort = process.env.CANVAS_AGENT_PORT || "3210";
    const agentHost = `127.0.0.1:${agentPort}`;
    const subPath = path && path.length > 0 ? "/" + path.map(encodeURIComponent).join("/") : "";
    const search = request.nextUrl.search;
    const target = `http://${agentHost}${subPath}${search}`;

    const origin = resolveOrigin(request);

    const headers = new Headers();
    for (const [key, value] of request.headers.entries()) {
        const lower = key.toLowerCase();
        if (
            lower === "host" ||
            lower === "content-length" ||
            lower === "connection" ||
            lower === "transfer-encoding"
        ) {
            continue;
        }
        headers.set(key, value);
    }

    // Canvas agent strictly checks Host header (must be 127.0.0.1:port or localhost:port)
    headers.set("host", agentHost);

    // Keep origin strictly consistent for session validation across /events and /connect
    headers.set("origin", origin);

    const hasBody = request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS";
    let bodyBuffer: ArrayBuffer | undefined;
    if (hasBody) {
        try {
            bodyBuffer = await request.arrayBuffer();
        } catch {
            bodyBuffer = undefined;
        }
    }

    try {
        const response = await fetch(target, {
            method: request.method,
            headers,
            body: bodyBuffer,
            redirect: "manual",
            signal: request.signal,
        });

        const resHeaders = new Headers(response.headers);
        resHeaders.delete("content-length");
        resHeaders.delete("content-encoding");
        resHeaders.delete("transfer-encoding");

        const contentType = response.headers.get("content-type") || "";
        if (contentType.toLowerCase().includes("text/event-stream")) {
            resHeaders.set("Content-Type", "text/event-stream");
            resHeaders.set("Cache-Control", "no-cache, no-transform");
            resHeaders.set("Connection", "keep-alive");
            resHeaders.set("X-Accel-Buffering", "no");
        }

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: resHeaders,
        });
    } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") {
            return new Response(null, { status: 499 });
        }
        console.error("Failed to proxy canvas agent:", target, error);
        return Response.json(
            { error: "连接本地 Agent 失败，请确认服务已启动 (端口 " + agentPort + ")" },
            { status: 502 }
        );
    }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
export const HEAD = proxy;
