import 'server-only';

import { getAuthOperation, type AuthOperation } from '@engine/auth-contract';
import type { PortalConfig } from '@engine/portal-config';

/**
 * 创建仅后端使用的引擎调用器，页面不得导入此模块。
 * @param config 由 readConfig 读取的服务端配置；其中密钥不可传到浏览器或日志。
 * @returns request({ operation, headers, payload })，不会自动跟随上游跳转。
 * 生产模式添加引擎鉴权头；开发代理模式只调用已有门户，不转发引擎密钥。
 * 仅负责传输；来源/字段校验应通过 handleAuth 完成，响应必须经过 authResponse。
 */
export function createPlayerServiceClient(config:PortalConfig) {
    return {
        async request({
            operation,
            headers,
            payload,
        }:{
            operation:AuthOperation;
            headers:Headers;
            payload?:object;
        }):Promise<Response> {
            const forwarded = new Headers(headers);
            const route = config.isDevelopmentPortal ? 'auth' : 'player-auth';
            const prefix = config.isDevelopmentPortal
                ? config.upstream.pathname.replace(/\/$/, '')
                : '';
            if (config.isDevelopmentPortal) {
                // The existing local portal holds the engine key. Developers never need
                // to retrieve that key or send it to a browser.
                forwarded.delete('X-Box-Player-Auth-Key');
                forwarded.set('Origin', config.upstream.origin);
            } else {
                forwarded.set('X-Box-Player-Auth-Key', config.apiKey);
            }
            if (payload) {
                forwarded.set('Content-Type', 'application/json');
            }
            return fetch(new URL(`${prefix}/api/${route}/${operation}`, config.upstream), {
                method: getAuthOperation(operation)!.method,
                headers: forwarded,
                body: payload ? JSON.stringify(payload) : undefined,
                cache: 'no-store',
                redirect: 'manual',
                signal: AbortSignal.timeout(config.timeoutMs),
            });
        },
    };
}
