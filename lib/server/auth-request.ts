import 'server-only';
import { isIP as isIp } from 'node:net';

import { playerCookieHeader } from '@engine/session-cookies';
import { getAuthOperation, type AuthOperation } from '@engine/auth-contract';

const MAX_BODY_BYTES = 32 * 1024;
export class InputError extends Error {
    public constructor(
        public readonly status:number,
        message:string,
    ) {
        super(message);
    }
}
function parseHttpUrl(raw:string | undefined):URL | null {
    try {
        const url = new URL(raw || '');
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
            ? url
            : null;
    } catch {
        return null;
    }
}
async function readBody(request:Request):Promise<Record<string, unknown>> {
    if (
        request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !==
        'application/json'
    ) {
        throw new InputError(415, '请使用 JSON 请求');
    }
    if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
        throw new InputError(413, '请求内容过大');
    }
    const reader = request.body?.getReader();
    const chunks:Uint8Array[] = [];
    let size = 0;
    if (reader) {
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                size += value.byteLength;
                if (size > MAX_BODY_BYTES) {
                    await reader.cancel();
                    throw new InputError(413, '请求内容过大');
                }
                chunks.push(value);
            }
        } finally {
            reader.releaseLock();
        }
    }
    try {
        const body:unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            throw new Error();
        }
        return body as Record<string, unknown>;
    } catch {
        throw new InputError(400, '请求内容不是有效的 JSON 对象');
    }
}
function resolveReturnUrl(source:unknown, requested:unknown):string | undefined {
    const base = parseHttpUrl(
        source === 'play'
            ? process.env.BOX_PLAY_PUBLIC_URL
            : source === 'creator'
              ? process.env.BOX_CREATOR_PUBLIC_URL
              : undefined,
    );
    if (!base) {
        return;
    }
    const candidate = parseHttpUrl(
        new URL(typeof requested === 'string' ? requested : '', base).href,
    );
    return candidate?.origin === base.origin ? candidate.href : base.href;
}

function isLoopback(url:URL):boolean {
    return (
        url.hostname === 'localhost' ||
        url.hostname === '[::1]' ||
        /^127(?:\.\d{1,3}){3}$/.test(url.hostname)
    );
}
/**
 * 校验写请求的浏览器来源，防止跨站请求借用现有玩家 Cookie。
 * 开发模式只兼容同协议、同端口的本机别名；生产按公开地址严格匹配。
 * 来源头可以被命令行伪造，因此此检查不是身份认证，仍依赖引擎会话和限流。
 */
export function validateOrigin(request:Request, publicUrl:URL | null) {
    if (request.method === 'GET') {
        return;
    }
    const rawOrigin = request.headers.get('origin');
    const origin = rawOrigin ? parseHttpUrl(rawOrigin) : null;
    const expected = publicUrl || new URL(request.url);
    // Next's development route URL can use localhost even when the browser
    // opened 127.0.0.1. Match local aliases only in dev, without opening up ports.
    const localAlias =
        process.env.NODE_ENV === 'development' &&
        origin &&
        isLoopback(origin) &&
        isLoopback(expected) &&
        origin.protocol === expected.protocol &&
        origin.port === expected.port;
    if (
        request.headers.get('sec-fetch-site') === 'cross-site' ||
        (rawOrigin && (!origin || (origin.origin !== expected.origin && !localAlias)))
    ) {
        throw new InputError(403, '请求来源不受允许');
    }
}

export { parseHttpUrl };
export async function readAuthInput(request:Request, name:AuthOperation) {
    const body = request.method === 'GET' ? {} : await readBody(request);

    const navigationFields = name === 'login' || name === 'register' ? ['source', 'returnUrl', 'transferState', 'transferChallenge'] : [];
    if (
        Object.keys(body).some(
            (field) =>
                !getAuthOperation(name)!.fields.includes(field) &&
                !navigationFields.includes(field),
        )
    ) {
        throw new InputError(400, '请求包含不支持的字段');
    }
    for (const field of getAuthOperation(name)!.fields) {
        if (typeof body[field] !== 'string') {
            throw new InputError(400, '请填写完整的账号信息');
        }
    }
    const payload = Object.fromEntries(
        getAuthOperation(name)!.fields.map((field) => [field, body[field]]),
    );
    if (name === 'register') {
        if (!/^[A-Za-z][A-Za-z0-9_]{2,31}$/.test(String(payload.username))) {
            throw new InputError(400, '用户名须为 3–32 位，以字母开头，仅包含字母、数字或下划线');
        }
    }
    if ('displayName' in payload) {
        const displayName = String(payload.displayName).trim();
        if (!displayName || displayName.length > 32 || /[\r\n]/.test(displayName)) {
            throw new InputError(400, '昵称须为 1–32 个字符且不能换行');
        }
        payload.displayName = displayName;
    }
    const newPassword =
        name === 'register'
            ? payload.password
            : name === 'password'
              ? payload.newPassword
              : undefined;
    if (typeof newPassword === 'string' && (newPassword.length < 10 || newPassword.length > 128)) {
        throw new InputError(400, '新密码须为 10–128 个字符');
    }
    const query = new URL(request.url).searchParams;
    // 导航目标只允许服主配置的游玩端或创作端同源地址。
    let target:string | undefined;
    try {
        target = resolveReturnUrl(
            body.source ?? query.get('source'),
            body.returnUrl ?? query.get('returnUrl'),
        );
    } catch {
        target = resolveReturnUrl(body.source ?? query.get('source'), '');
    }
    const source = String(body.source ?? query.get('source') ?? '');
    const state = String(body.transferState ?? query.get('transferState') ?? '');
    const challenge = String(body.transferChallenge ?? query.get('transferChallenge') ?? '');
    const transfersLogin = ['login', 'register', 'session'].includes(name);
    if (transfersLogin && (state || challenge) &&
        (!['play', 'creator'].includes(source) || !/^[A-Za-z0-9_-]{43}$/.test(state) || !/^[A-Za-z0-9_-]{43}$/.test(challenge))) {
        throw new InputError(400, '登录请求无效，请从应用重新登录');
    }
    const transfer = transfersLogin && state && challenge ? { source, state, challenge } : undefined;
    return { payload, target, transfer };
}
/**
 * 只构造账号服务需要的转发头，忽略客户端自行提供的引擎鉴权头。
 * isTrustedProxy 只能在可信入口已清洗转发 IP 头时开启，不能用于绕过来源校验。
 */
export function createForwardedHeaders({
    request,
    publicUrl,
    isTrustedProxy,
}:{
    request:Request;
    publicUrl:URL | null;
    isTrustedProxy:boolean;
}) {
    const headers = new Headers({ Accept: 'application/json' });
    const cookie = playerCookieHeader(request.headers.get('cookie') || '');
    if (cookie) {
        headers.set('Cookie', cookie);
    }
    headers.set('User-Agent', (request.headers.get('user-agent') || '').slice(0, 512));
    const protocol =
        publicUrl?.protocol.replace(':', '') || new URL(request.url).protocol.replace(':', '');
    headers.set('X-Forwarded-Proto', protocol);
    if (isTrustedProxy) {
        const ip = (
            request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            ''
        )
            .split(',')[0]
            .trim();
        if (isIp(ip)) {
            headers.set('X-Forwarded-For', ip);
            headers.set('X-Real-IP', ip);
        }
    }

    return headers;
}
