import 'server-only';

import { readConfig } from '@engine/portal-config';
import { createPlayerServiceClient } from '@engine/player-service-client';
import { getAuthOperation, type AuthOperation } from '@engine/auth-contract';
import {
    InputError,
    parseHttpUrl,
    validateOrigin,
    readAuthInput,
    createForwardedHeaders,
} from '@engine/auth-request';
import { reply, authResponse } from '@engine/auth-response';

/** 服主的鉴权策略只能在后端执行，输入字段已经完成基础校验。 */
export interface AuthRequestContext {
    request:Request;
    operation:AuthOperation;
    input:Readonly<Record<string, unknown>>;
}
export interface AuthHandlerOptions {
    /** 返回 undefined 放行；返回 Response 结束请求，例如返回安全的 401/403 JSON。 */
    authorize?:(
        context:AuthRequestContext,
    ) => Promise<Response | undefined> | Response | undefined;
}

/**
 * HTTP 路由使用的账号请求入口：固定操作 → 来源校验 → 字段校验 → 上游 → 公开响应。
 * @param request 浏览器请求，不信任其内部鉴权头或任意上游地址。
 * @param name 必须是后端契约中的操作名；未知操作返回 404。
 * @returns 无缓存的 JSON 响应，保留上游状态码及支持的玩家 Cookie。
 * 扩展功能时同步更新后端契约、字段校验、响应白名单和回归测试。
 */
export async function handleAuth(
    request:Request,
    name:string,
    options:AuthHandlerOptions = {},
):Promise<Response> {
    const definition = getAuthOperation(name);
    if (!definition) {
        return reply(404, { message: '接口不存在' });
    }
    const operation = name as AuthOperation;

    if (request.method !== definition.method) {
        return reply(
            405,
            { message: '请求方法不受支持' },
            new Headers({ Allow: definition.method }),
        );
    }
    try {
        const publicUrl = parseHttpUrl(process.env.BOX_AUTH_PORTAL_PUBLIC_URL);
        validateOrigin(request, publicUrl);
        if (
            operation === 'register' &&
            process.env.BOX_PLAYER_REGISTRATION_ENABLED?.trim().toLowerCase() === 'false'
        ) {
            throw new InputError(403, '服主已关闭玩家注册');
        }
        let config;
        try {
            config = readConfig();
        } catch {
            return reply(503, {
                code: 'CONFIGURATION_ERROR',
                message: '登录服务未配置完成，请检查开发地址或启动器运行配置',
            });
        }
        const { payload, target } = await readAuthInput(request, operation);
        if (options.authorize) {
            try {
                const denied = await options.authorize({
                    request,
                    operation,
                    input: Object.freeze({ ...payload }),
                });
                if (denied) {
                    denied.headers.set('Cache-Control', 'no-store');
                    denied.headers.set('X-Content-Type-Options', 'nosniff');
                    return denied;
                }
            } catch {
                // 自定义鉴权异常必须拒绝请求，不可降级为默认放行。
                return reply(503, {
                    code: 'AUTHORIZATION_UNAVAILABLE',
                    message: '本站鉴权服务暂时不可用',
                });
            }
        }

        const isTrustedProxy =
            (process.env.BOX_TRUST_PROXY ?? process.env.AUTH_DEMO_TRUST_PROXY) === 'true';
        const response = await createPlayerServiceClient(config).request({
            operation,
            headers: createForwardedHeaders({ request, publicUrl, isTrustedProxy }),
            payload: request.method === 'GET' ? undefined : payload,
        });
        return await authResponse({ response, request, operation, config, target });
    } catch (error) {
        if (error instanceof InputError) {
            return reply(error.status, {
                code: 'INVALID_REQUEST',
                message: error.message,
            });
        }
        const isTimeout =
            error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
        return reply(isTimeout ? 504 : 502, {
            code: isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
            message: isTimeout
                ? '玩家服务响应超时，请稍后重试'
                : '暂时无法连接玩家服务，请稍后重试',
        });
    }
}
