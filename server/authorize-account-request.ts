import 'server-only';

import type { AuthRequestContext } from '@engine/handle-auth';

/**
 * 服主自己的后端鉴权扩展点，默认不增加额外限制，账号会话仍由引擎验证。
 * @param context request 可读取请求头和 Cookie；input 是已经校验的冻结字段副本。
 * request 正文已经读取，不能再次调用 request.json()；需要账号字段时读取 input。
 * input 可能包含密码，不要打印完整 context/input，也不要整包发送给第三方服务。
 * @returns undefined 继续调用引擎；返回 JSON Response 可以拒绝请求或给出自定义结果。
 *
 * 可在此调用服主后端的验证码、注册码或外部会话验证服务。
 * 不要信任前端自称的角色、玩家 ID、布尔标记或未经验证的 JWT。
 * 登录/注册/匿名会话查询通常需要允许匿名访问，否则玩家无法开始登录。
 * 策略抛错时 SDK 会拒绝请求，不会自动放行；响应中不要包含密钥或调试详情。
 * 这是额外的业务鉴权，不能绕过引擎的有效玩家会话与权限要求。
 */
export async function authorizeAccountRequest(
    context:AuthRequestContext,
):Promise<Response | undefined> {
    // 服主在这里读取 context.operation / context.input，接入自己的验证逻辑。
    return undefined;
}
