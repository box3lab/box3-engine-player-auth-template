import 'server-only';

import { handleAuth } from '@engine/handle-auth';
import { authorizeAccountRequest } from '@server/authorize-account-request';

/**
 * 服主自己的本站 API 入口，前端只访问 app/api 中挂载的 HTTP 路由。
 * 此文件属于可定制业务层；可以增加业务审计、额外鉴权和公开响应处理。
 * 引擎调用仍由服务端 SDK 完成，禁止把引擎密钥返回给前端。
 */
export function handleAccountRequest(request:Request, operation:string):Promise<Response> {
    return handleAuth(request, operation, { authorize: authorizeAccountRequest });
}
