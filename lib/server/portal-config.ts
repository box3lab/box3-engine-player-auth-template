import 'server-only';

/** Runtime settings are read on the backend, never through NEXT_PUBLIC_ variables. */
export interface PortalConfig {
    isDevelopmentPortal:boolean;
    upstream:URL;
    apiKey:string;
    timeoutMs:number;
}
/**
 * 从后端环境读取运行配置，优先使用标准 BOX_* 名称。
 * 开发门户代理只在 development 下启用；生产依赖启动器注入内部地址和密钥。
 * @param env 默认 process.env；测试可传入独立的环境字典。
 * @returns 服务端配置对象；不能放进页面 props、JSON 响应或 NEXT_PUBLIC_*。
 * @throws 配置 URL、认证密钥或超时不合法时抛错，由路由转成安全的 503 提示。
 */
export function readConfig(env:NodeJS.ProcessEnv = process.env):PortalConfig {
    const developmentUrl =
        env.NODE_ENV === 'development' ? env.BOX_DEV_AUTH_PORTAL_URL?.trim() : '';
    const isDevelopmentPortal = Boolean(developmentUrl);
    const upstream = new URL(
        developmentUrl ||
            env.BOX_PLAYER_SERVICE_INTERNAL_URL ||
            env.AUTH_DEMO_PLAYER_SERVICE_URL ||
            'http://player-service:3213',
    );
    if (
        !['http:', 'https:'].includes(upstream.protocol) ||
        upstream.username ||
        upstream.password ||
        upstream.search ||
        upstream.hash
    ) {
        throw new Error('上游地址须为不含凭据、查询参数或片段的 HTTP(S) 地址');
    }
    const apiKey = (env.BOX_PLAYER_AUTH_API_KEY || env.AUTH_DEMO_API_KEY || '').trim();
    if (!isDevelopmentPortal && apiKey.length < 16) {
        throw new Error('玩家服务认证密钥尚未注入');
    }
    return {
        isDevelopmentPortal,
        upstream,
        apiKey,
        timeoutMs: requestTimeoutMs(env),
    };
}

export function requestTimeoutMs(env:NodeJS.ProcessEnv = process.env):number {
    // 标准名称优先；当前启动器通过兼容名称注入此配置。
    const raw = env.BOX_AUTH_PORTAL_REQUEST_TIMEOUT_MS ?? env.AUTH_DEMO_REQUEST_TIMEOUT_MS;
    const value = Number(raw?.trim() || 10000);
    if (!Number.isInteger(value) || value < 1000 || value > 60000) {
        throw new Error('请求超时配置须为 1000–60000 毫秒的整数');
    }
    return value;
}
