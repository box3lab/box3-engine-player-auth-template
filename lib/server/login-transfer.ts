import 'server-only';
import type { PortalConfig } from '@engine/portal-config';
import { InputError, parseHttpUrl, createForwardedHeaders } from '@engine/auth-request';
import { playerCookieHeader } from '@engine/session-cookies';

export interface LoginTransfer {
    source:string;
    state:string;
    challenge:string;
}

/** Only configured application callbacks receive a short-lived, single-use code. */
export async function loginTransferTarget(request:Request, response:Response, config:PortalConfig, transfer?:LoginTransfer):Promise<string | undefined> {
    if (!transfer || !response.ok) return undefined;
    const data = await response.clone().json();
    if (!data.player) return undefined;
    const base = parseHttpUrl(transfer.source === 'play' ? process.env.BOX_PLAY_PUBLIC_URL : process.env.BOX_CREATOR_PUBLIC_URL);
    if (!base) throw new InputError(503, '请先配置应用的公网地址');
    const callback = new URL(base);
    callback.pathname = `${callback.pathname.replace(/\/$/, '')}/api/player-login/callback`;
    callback.search = '';
    callback.hash = '';
    if (config.isDevelopmentPortal) {
        const returned = parseHttpUrl(data.returnUrl);
        if (!returned || returned.origin !== callback.origin || returned.pathname !== callback.pathname ||
            returned.searchParams.get('state') !== transfer.state || !/^[A-Za-z0-9_-]{43}$/.test(returned.searchParams.get('code') || '')) {
            throw new InputError(502, '原登录门户尚未支持独立公网登录，请同步更新引擎');
        }
        return returned.href;
    }
    const cookies = new Map<string, string>();
    for (const cookie of [
        ...playerCookieHeader(request.headers.get('cookie') || '').split(';'),
        ...response.headers.getSetCookie().map(value => value.split(';')[0]),
    ]) {
        const pair = playerCookieHeader(cookie).trim();
        const separator = pair.indexOf('=');
        if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    const headers = createForwardedHeaders({ request,
        publicUrl: parseHttpUrl(process.env.BOX_AUTH_PORTAL_PUBLIC_URL),
        isTrustedProxy: (process.env.BOX_TRUST_PROXY ?? process.env.AUTH_DEMO_TRUST_PROXY) === 'true',
    });
    headers.set('Content-Type', 'application/json');
    headers.set('X-Box-Player-Auth-Key', config.apiKey);
    headers.set('Cookie', [...cookies].map(([name, value]) => `${name}=${value}`).join('; '));
    const result = await fetch(new URL('/api/player-auth/transfer', config.upstream), {
        method: 'POST', headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(config.timeoutMs),
        body: JSON.stringify({ source: transfer.source, challenge: transfer.challenge }),
    });
    const code = await result.json();
    if (!result.ok || typeof code.code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(code.code)) {
        throw new InputError(502, '无法同步登录状态，请从应用重新登录');
    }
    callback.searchParams.set('code', code.code);
    callback.searchParams.set('state', transfer.state);
    return callback.href;
}
