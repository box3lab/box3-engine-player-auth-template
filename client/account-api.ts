import type {
    Session,
    Player,
    Navigation,
    Credentials,
    Registration,
    ProfileUpdate,
    PasswordChange,
} from '@shared/account-types';

export type { Session, Player } from '@shared/account-types';

// 本站接口的 HTTP 方法，由服主自己的前后端约定；不导入引擎 SDK。
const ACCOUNT_METHODS = {
    session: 'GET',
    login: 'POST',
    register: 'POST',
    logout: 'POST',
    profile: 'PATCH',
    password: 'POST',
} as const;
type AccountOperation = keyof typeof ACCOUNT_METHODS;

/**
 * 本站 API 返回非成功 HTTP 状态时抛出的错误。
 * 服主可读取 code、status 和 message 来定制提示，不要依赖完整错误字符串。
 * 网络中断、超时和 JSON 解析错误不一定是此类型，应保留通用错误兜底。
 */
export class AccountApiError extends Error {
    public constructor(
        message:string,
        public readonly code:string,
        public readonly status:number,
    ) {
        super(message);
        this.name = 'AccountApiError';
    }
}

async function request<T>(
    operation:AccountOperation,
    body?:object,
    navigation?:Navigation,
):Promise<T> {
    const method = ACCOUNT_METHODS[operation];
    const base = document.documentElement.dataset.basePath || '';
    const timeout = Number(document.documentElement.dataset.authTimeoutMs) || 15000;
    const query = navigation ? `?${new URLSearchParams(navigation)}` : '';
    const response = await fetch(`${base}/api/auth/${operation}${query}`, {
        method,
        credentials: 'same-origin',
        cache: 'no-store',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeout),
    });
    const data = await response.json();
    if (!response.ok) {
        let message = data.message || '请求失败，请稍后重试';
        if (typeof data.banReason === 'string') {
            message += `\n封禁原因：${data.banReason || '未说明'}`;
        }
        throw new AccountApiError(message, data.code || 'REQUEST_FAILED', response.status);
    }
    return data as T;
}

/**
 * 模板自身的本站 API 封装，服主可修改路径、请求头和参数；这里不是引擎 SDK。
 *
 * 仅在浏览器事件或 effect 中调用；不能在服务端渲染阶段调用。
 * 自动处理 Cookie、运行时路径前缀、JSON 正文和超时。
 * 注意：不要将密码或会话 token 写入日志、localStorage 或 NEXT_PUBLIC_*。
 * 如果不想自行处理加载状态与提示，优先使用 hooks/use-account 中的 useAccount。
 *
 * @example
 * const session = await accounts.session();
 * await accounts.login({ username, password });
 */
export const accounts = {
    /**
     * 查询当前浏览器在此服务器的会话，不会创建账号或执行登录。
     * @param navigation 可选的 source、returnUrl；回跳地址由后端白名单限制。
     * @returns 会话信息；未登录时 player 为 null，注册开关可能由引擎返回。
     * @throws AccountApiError 当本站或引擎返回 HTTP 错误时。
     * @example const { player } = await accounts.session();
     */
    session: (navigation:Navigation = {}) => request<Session>('session', undefined, navigation),
    /**
     * 使用真实玩家账号登录，成功后浏览器自动接收 HttpOnly 会话 Cookie。
     * @param input username 为登录账号，password 为玩家输入的密码。
     * 可选 source 为 play/creator；returnUrl 必须属于服主配置的同源白名单。
     * @returns 登录结果；页面应以返回的 player 判断是否有已登录用户。
     * @throws AccountApiError 例如密码错误、封禁或登录限流；网络错误需另行兜底。
     * @example await accounts.login({ username, password });
     */
    login: (input:Credentials & Navigation) => request<Session>('login', input),
    /**
     * 向当前引擎注册玩家；是否开放注册、是否自动登录由引擎策略决定。
     * @param input username 为 3–32 位字母开头的字母/数字/下划线账号。
     * displayName 为 1–32 字符昵称；password 为 10–128 字符新密码。
     * 此底层 API 不接收 confirmPassword；页面或 useAccount 负责确认两次密码一致。
     * @returns 注册结果；不要假设成功注册一定代表已登录，应检查 player。
     * @example await accounts.register({ username, displayName, password });
     */
    register: (input:Registration & Navigation) => request<Session>('register', input),
    /**
     * 通知引擎退出当前会话，并由服务端清理相应 Cookie。
     * @returns 上游操作结果；页面应在成功后清空展示的玩家信息。
     * 失败时不要只隐藏界面就声称已经退出，服务端会话可能仍然有效。
     * @example await accounts.logout();
     */
    logout: () => request<{ ok?:boolean }>('logout', {}),
    /**
     * 修改当前已登录玩家的显示昵称，不是修改登录用户名。
     * @param input displayName 为 1–32 字符，前后空白会由后端去除。
     * @returns 最新的公开 player 字段，可用于同步页面展示。
     * 操作目标取决于有效会话，不能传玩家 ID 来修改其他玩家。
     * @example const { player } = await accounts.updateProfile({ displayName });
     */
    updateProfile: (input:ProfileUpdate) => request<{ player:Player }>('profile', input),
    /**
     * 使用当前密码修改已登录账号的密码，完成后需要重新登录。
     * @param input currentPassword 为当前密码，newPassword 为 10–128 字符新密码。
     * 确认密码应在页面或 useAccount 中校验，不会发送给引擎。
     * @returns 上游操作结果；成功后页面应清空会话展示并返回登录界面。
     * @example await accounts.changePassword({ currentPassword, newPassword });
     */
    changePassword: (input:PasswordChange) => request<{ ok?:boolean }>('password', input),
};
