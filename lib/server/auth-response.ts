import 'server-only';

import type { PortalConfig } from '@engine/portal-config';
import { isPlayerCookie } from '@engine/session-cookies';
import type { AuthOperation } from '@engine/auth-contract';

export function reply(status:number, data:unknown, headers = new Headers()) {
    headers.set('Cache-Control', 'no-store');
    headers.set('X-Content-Type-Options', 'nosniff');
    return Response.json(data, { status, headers });
}

export interface AuthResponseOptions {
    response:Response;
    request:Request;
    operation:AuthOperation;
    config:PortalConfig;
    target?:string;
}

/**
 * 将可信上游响应整理为浏览器可见的公开结果。
 * 只返回明确白名单字段，隐藏已知的内部地址和密钥，只转发支持的玩家 Cookie。
 * 新功能需要额外返回字段时，应明确新增公开字段，不能直接透传上游整个对象。
 * 开发模式调整 Cookie 域和路径以便本机联调；生产保留 Secure/Domain 等属性。
 */
export async function authResponse({
    response,
    request,
    operation: name,
    config,
    target,
}:AuthResponseOptions) {
    const registrationEnabled =
        process.env.BOX_PLAYER_REGISTRATION_ENABLED?.trim().toLowerCase() !== 'false';
    if (response.status >= 300 && response.status < 400) {
        throw new Error('Unexpected redirect');
    }
    const data:unknown = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Invalid response');
    }
    // Allow only public account fields. Extra upstream/internal fields must
    // never become browser API data, even if an upstream implementation changes.
    const raw = data as Record<string, unknown>;
    const sanitizePublicValue = (value:unknown) => {
        if (typeof value !== 'string') {
            return value;
        }
        for (const secret of [config.apiKey, config.upstream.href, config.upstream.origin]) {
            if (secret) {
                value = (value as string).split(secret).join('[已隐藏]');
            }
        }
        return value;
    };
    const result:Record<string, unknown> = {};
    for (const field of [
        'ok',
        'code',
        'message',
        'registrationEnabled',
        'banReason',
        'bannedUntil',
    ]) {
        if (['string', 'boolean', 'number'].includes(typeof raw[field]) || raw[field] === null) {
            result[field] = sanitizePublicValue(raw[field]);
        }
    }
    if (raw.player === null) {
        result.player = null;
    } else if (raw.player && typeof raw.player === 'object' && !Array.isArray(raw.player)) {
        const player = raw.player as Record<string, unknown>;
        result.player = Object.fromEntries(
            ['id', 'username', 'displayName']
                .filter((field) => typeof player[field] === 'string')
                .map((field) => [field, sanitizePublicValue(player[field])]),
        );
    }
    if (target && ['session', 'login', 'register'].includes(name)) {
        result.returnUrl = target;
    }
    if (name === 'session') {
        result.registrationEnabled = registrationEnabled && result.registrationEnabled !== false;
    }
    const outgoing = new Headers();
    // 不拆分 Cookie 字符串：Expires 日期内也含逗号。
    for (let cookie of response.headers.getSetCookie()) {
        if (!isPlayerCookie(cookie.split(';', 1)[0])) {
            continue;
        }
        if (!/;\s*HttpOnly(?=;|$)/i.test(cookie)) {
            cookie += '; HttpOnly';
        }
        if (config.isDevelopmentPortal) {
            // Local testing needs host-only cookies scoped to this development
            // portal, rather than the existing engine's public domain/path.
            cookie = cookie.replace(/;\s*Domain=[^;]*/gi, '').replace(/;\s*Path=[^;]*/gi, '');
            cookie += `; Path=${process.env.BOX_APP_BASE_PATH || '/'}`;
            if (new URL(request.url).protocol === 'http:') {
                cookie = cookie.replace(/;\s*Secure(?=;|$)/gi, '');
            }
        }
        outgoing.append('Set-Cookie', cookie);
    }
    const retry = response.headers.get('retry-after');
    if (retry) {
        outgoing.set('Retry-After', retry);
    }
    return reply(response.status, result, outgoing);
}
