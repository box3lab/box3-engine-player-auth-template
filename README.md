# BOX3 Player Auth Portal

基于 Next.js、React 和 TypeScript 的玩家账号门户模板，支持登录、注册、退出、修改昵称和修改密码。账号与会话由引擎管理，页面和本站 API 可自行定制。

## 本地开发

需要 Node.js 22.23.3 或兼容的新版本。先在 BOX3 启动器中启动玩家服务和原登录门户，再运行：

```sh
npm install
cp .env.example .env.local
```

在 `.env.local` 中填写原登录门户的实际地址（不是玩家服务或管理器地址）：

```dotenv
BOX_DEV_AUTH_PORTAL_URL=http://127.0.0.1:3125
```

```sh
npm run dev
```

打开 [http://127.0.0.1:3214](http://127.0.0.1:3214)。开发模式通过原门户对接引擎，无需复制引擎密钥。修改环境变量后需重启；端口冲突时在 `.env.local` 中设置 `PORT`。

模拟启动器的子路径访问时，停止普通开发服务，再运行：

```sh
npm run dev:path
```

打开 [http://127.0.0.1:3214/accounts/](http://127.0.0.1:3214/accounts/)。页面、静态资源和本站 API 都使用此路径前缀。需要其他路径时运行 `npm run dev -- --base-path=/login`；这些命令只调整本项目路径，原门户地址保持实际配置。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run dev:path` | 在 `/accounts` 下启动开发服务器，模拟启动器路径 |
| `npm run check` | 类型检查和生产构建；本地有基础测试时也会运行 |
| `npm run image` | 检查并导出 ARM64、AMD64 Docker 镜像 |
| `npm run image -- arm64` | 只构建 ARM64 镜像 |
| `npm run image -- amd64` | 只构建 AMD64 镜像 |

镜像构建需要 Docker 和 Buildx，产物保存在 `dist/`。本地 `tests/` 不提交到仓库，没有测试目录也可以运行检查。

## 目录与路径别名

| 目录 | 用途 | 别名 |
| --- | --- | --- |
| `app/` | 页面、样式和 HTTP 路由 | — |
| `components/` | 登录、注册及账号表单 | `@components/*` |
| `hooks/` | 账号状态与操作 | `@hooks/*` |
| `client/` | 自定义的浏览器 API 封装 | `@client/*` |
| `server/` | 自定义的后端业务与鉴权 | `@server/*` |
| `lib/server/` | 仅后端使用的引擎 API 封装 | `@engine/*` |
| `lib/shared/` | 公开账号数据类型 | `@shared/*` |
| `scripts/` | 开发、检查及镜像构建脚本 | — |

别名在 `tsconfig.json` 中配置，例如：

```ts
import { useAccount } from '@hooks/use-account';
import { LoginForm } from '@components/login-form';
import { accounts } from '@client/account-api';
```

页面可使用 `useAccount()` 管理账号流程，也可在浏览器事件中调用 `accounts.login({ username, password })` 等方法。参数与返回值可在编辑器中查看类型和注释。

## 自定义 API 与鉴权

请求链路：

```text
页面 → client/account-api → app/api → server/account-api → 引擎 API → 玩家服务
```

前端只访问本站接口（默认 `/api/auth/*`）；引擎地址、密钥和 API 封装保留在后端。

- 修改 `client/account-api.ts`：定制本站请求路径、参数和错误处理。
- 修改 `server/account-api.ts`：扩展后端业务。
- 修改 `server/authorize-account-request.ts`：添加验证码、注册码或其他鉴权。

鉴权函数可读取 `context.operation` 和已校验的 `context.input`。返回 `undefined` 继续调用引擎，返回 `Response` 结束请求；抛出异常会拒绝请求。不要记录密码或将引擎密钥放入前端代码。

### 示例：登录或注册前验证验证码

在页面完成验证码后，把供应商返回的 token 放在本站请求头 `X-Captcha-Token` 中。可在 `client/account-api.ts` 的请求封装中添加此请求头；不要往引擎 JSON 正文中加入 `captchaToken`，现有字段白名单会拒绝它。

以下代码替换 `server/authorize-account-request.ts`。示例约定服主自己的验证服务提供 `POST /captcha/verify`，使用服务端密钥鉴权，验证成功返回 `{ "verified": true }`；按实际验证码供应商调整地址、参数和返回值。

```ts
import 'server-only';

import type { AuthRequestContext } from '@engine/handle-auth';

export async function authorizeAccountRequest({ request, operation }:AuthRequestContext) {
    if (operation !== 'login' && operation !== 'register') {
        return;
    }
    const token = request.headers.get('X-Captcha-Token');
    if (!token || token.length > 4096) {
        return Response.json(
            { code: 'CAPTCHA_REQUIRED', message: '请先完成验证码' },
            { status: 403 },
        );
    }
    const url = process.env.OWNER_VERIFICATION_URL;
    const key = process.env.OWNER_VERIFICATION_KEY;
    if (!url || !key) {
        throw new Error('Verification service is not configured');
    }
    const response = await fetch(new URL('/captcha/verify', url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ token, purpose: operation }),
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
        redirect: 'error',
    });
    if (!response.ok) {
        throw new Error('Verification service is unavailable');
    }
    const result = await response.json();
    if (result.verified !== true) {
        return Response.json(
            { code: 'CAPTCHA_INVALID', message: '验证码无效，请重试' },
            { status: 403 },
        );
    }
}
```

验证服务应检查 token 是否过期、是否用于本站，以及是否已使用。验证失败返回 403；服务异常由模板统一返回 503。匿名会话查询、退出等操作不要求验证码。

### 示例：注册前验证邮箱

邮箱验证由服主自己的后端负责，可以按以下流程扩展：

1. 新增 `app/api/email/send/route.ts`：接收邮箱，调用邮件服务发送验证码，并限制发送频率。
2. 新增 `app/api/email/verify/route.ts`：核对验证码，成功后签发短期、一次性的注册凭证，绑定邮箱、待注册用户名和当前浏览器验证会话。
3. 注册表单提交时，将凭证放在 `X-Email-Verification` 请求头中；账号正文仍只包含原有注册字段。
4. 在 `authorizeAccountRequest` 的注册分支中，用凭证和 `context.input.username` 调用服主后端验证服务；只有验证通过才调用引擎注册。

例如在已有请求封装中发送凭证：

```ts
// client/account-api.ts：emailProof 是本站邮箱验证接口返回的凭证。
const headers = {
    'Content-Type': 'application/json',
    'X-Email-Verification': emailProof,
};
```

后端验证服务应核对凭证签名或存储记录、有效期、用户名和验证会话，并原子地消费一次性凭证。可以复用上面的服务调用方式，将地址改为 `/email/verify-proof`，正文只发送 `{ proof, username }`，浏览器验证会话通过可信的后端约定关联。验证不通过返回 `{ code: 'EMAIL_VERIFICATION_REQUIRED', message: '请先验证邮箱' }`，状态码为 403；引擎注册失败后允许重新取得凭证。

模板的引擎注册接口不保存邮箱。若需绑定邮箱与玩家账号，服主应自行保存关联，并在引擎注册成功后完成绑定；不能用客户端传入的 `emailVerified: true` 作为依据。新增的邮箱接口需要来源校验、输入校验、有效期及尝试次数限制，前端请求也要带上当前页面的路径前缀。

以上是接入示例，模板未内置邮件或验证码供应商。`OWNER_VERIFICATION_URL` 和 `OWNER_VERIFICATION_KEY` 是服主新增的服务端配置：本地放在 `.env.local`，生产需在部署环境中另外注入，启动器不会自动生成这些自定义配置。

## 镜像部署

运行 `npm run image` 后，在目标 Docker 主机加载对应架构的文件，例如：

```sh
docker load -i dist/box3-player-auth-portal-1.0.0-arm64.tar.gz
```

在启动器的「数据配置 → 访问设置 → 登录页面镜像」中填写对应镜像名，例如 `box3-player-auth-portal:1.0.0-arm64`，保存并重启相关服务。版本号取自 `package.json`。

生产配置由启动器注入，包括玩家服务内部地址、引擎密钥、公开地址和路径前缀；生产服务不读取 `.env.local`。

## 许可证

[MIT](LICENSE)
