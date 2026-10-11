# BOX3 Player Auth Portal

基于 **BOX3 本地引擎** 的玩家登录门户模板，使用 Next.js、React 和 TypeScript，支持登录、注册、退出、修改昵称和修改密码。账号与会话由引擎的玩家服务管理，页面和本站 API 可自行定制。

**需要在 BOX3 本地引擎启动器中配置为登录门户，并启动相关服务，才能完整使用账号功能。** 本项目不能脱离本地引擎作为独立账号系统使用；本地开发也依赖已运行的原登录门户和玩家服务。

## 本地开发

需要 Node.js 22.23.3 或兼容的新版本。先在启动器中启动玩家服务和原登录门户，再运行：

```sh
npm ci
cp .env.example .env.local
```

在 `.env.local` 中填写原登录门户的完整地址：

```dotenv
BOX_DEV_AUTH_PORTAL_URL=http://127.0.0.1:3125
```

端口以启动器实际配置为准；若原门户使用子路径，也要包含该路径。不要填成本项目的开发地址，否则会循环代理。

```sh
npm run dev
```

打开 [http://127.0.0.1:3214/](http://127.0.0.1:3214/)。开发模式通过原门户对接引擎，无需复制引擎密钥。修改环境变量后需重启；可在 `.env.local` 设置 `PORT` 更换端口。

模拟启动器的路径前缀时，停止普通开发服务，再运行：

```sh
npm run dev:path
```

打开 [http://127.0.0.1:3214/accounts/](http://127.0.0.1:3214/accounts/)。自定义路径可用 `npm run dev -- --base-path=/login`。同一项目不要同时运行两个开发服务。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run dev:path` | 在 `/accounts` 下启动开发服务器 |
| `npm run check` | 类型检查和生产构建 |
| `npm run image` | 构建并导出 ARM64、AMD64 Docker 镜像 |

只构建一种架构可用 `npm run image -- arm64` 或 `npm run image -- amd64`。镜像构建需要 Docker 和 Buildx，产物保存在 `dist/`。

## 架构与 API 流程

### 整体架构

```mermaid
flowchart TD
    subgraph browser[玩家浏览器]
        page["页面与表单 · app / components"]
        hook["状态与操作 · useAccount"]
        client["本站请求 · client/account-api"]
        page --> hook --> client
    end
    subgraph portal[本项目登录门户]
        route["HTTP 路由 · app/api/auth"]
        business["本站业务与额外鉴权 · server"]
        sdk["引擎调用与响应过滤 · lib/server"]
        route --> business --> sdk
    end
    client -->|同源请求与 Cookie| route
    sdk -->|生产：内部地址与服务端密钥| engine["BOX3 本地引擎玩家服务"]
    sdk -->|开发：BOX_DEV_AUTH_PORTAL_URL| original["启动器中已运行的原门户"]
    original --> engine
```

浏览器只访问本站 API；引擎密钥保留在后端。玩家服务负责账号与会话，门户负责页面、请求校验和服主自定义业务。图中生产、开发是两种运行方式。

### 注册、登录与会话查询

```mermaid
flowchart TD
    open[打开页面] --> session["GET /api/auth/session"]
    register["注册表单：先确认两次密码一致"] --> regApi["POST /api/auth/register"]
    login["登录表单：账号与密码"] --> loginApi["POST /api/auth/login"]
    session --> check["本站后端：方法、来源、配置与字段校验"]
    regApi --> check
    loginApi --> check
    check --> auth["服主额外鉴权 · 默认放行"]
    auth --> engine["玩家服务：查询会话 / 创建账号 / 验证登录"]
    engine --> response["门户过滤公开 JSON，并转发玩家 Cookie"]
    response --> player{"成功响应包含 player？"}
    player -->|是| overview[显示账号概览]
    player -->|否| form["显示登录页；注册成功则提示登录"]
    check -->|校验失败| error["显示错误，恢复表单操作"]
    auth -->|拒绝或异常| error
    engine -->|请求失败| error
```

登录后，会话 Cookie 由浏览器保存并自动随本站请求发送，JavaScript 不读取 HttpOnly Cookie。注册是否自动登录取决于引擎策略，因此页面以返回的 `player` 判断。后端返回的 `returnUrl` 经白名单校验，账号概览中的“继续”链接用于回到游玩或创作页面。

| 本站 API | 输入 | 页面行为 |
| --- | --- | --- |
| `GET /api/auth/session` | 无账号正文 | 首次加载时恢复会话 |
| `POST /api/auth/register` | `username`、`displayName`、`password` | 根据返回的 `player` 显示概览或提示登录 |
| `POST /api/auth/login` | `username`、`password` | 登录成功后显示账号概览 |
| `POST /api/auth/logout` | 空 JSON 对象 | 成功后返回登录页 |
| `PATCH /api/auth/profile` | `displayName` | 成功后更新昵称 |
| `POST /api/auth/password` | `currentPassword`、`newPassword` | 成功后提示重新登录 |

以上路径都相对于门户前缀；使用 `dev:path` 时，登录接口为 `/accounts/api/auth/login`。`confirmPassword` 仅在页面校验，不发送给引擎。

## 修改入口

| 文件或目录 | 用途 |
| --- | --- |
| `app/page.tsx`、`app/globals.css` | 页面外壳与样式 |
| `components/account-content.tsx` | 登录、注册与账号视图的组合 |
| `components/` | 表单、输入框和账号概览 |
| `hooks/use-account.ts` | 会话、加载状态、操作和错误提示 |
| `client/account-api.ts` | 本站浏览器 API 封装 |
| `server/account-api.ts` | 本站后端业务入口 |
| `server/authorize-account-request.ts` | 验证码等额外鉴权 |
| `lib/server/` | 仅后端使用的引擎调用与校验 |
| `lib/shared/account-types.ts` | 可公开的账号类型 |
| `scripts/security-headers.mjs` | 页面安全策略 |

先读页面、视图组合和 hook，即可了解界面流程。

路径别名在 `tsconfig.json` 中配置。页面可用 `useAccount()` 管理完整账号流程，也可在浏览器事件中直接调用：

```ts
import { accounts } from '@client/account-api';

await accounts.login({ username, password });
await accounts.register({ username, displayName, password });
await accounts.updateProfile({ displayName });
await accounts.changePassword({ currentPassword, newPassword });
await accounts.logout();
const session = await accounts.session();
```

这些方法自动处理同源 Cookie、路径前缀和超时。直接调用时需自行处理错误和界面状态；注册成功后应检查 `player`，改密成功后应返回登录页。`AccountApiError` 提供 `code`、`status` 和 `message`。

代码使用英文中横线文件名、4 空格缩进、单引号和具名导出；Next.js 必需的默认导出保留。浏览器只调用本站接口，不能导入 `@engine/*` 或后端模块。密码、引擎密钥和完整请求上下文不要写入日志。

### 扩展验证码或邮箱验证

在 `server/authorize-account-request.ts` 中添加服主自己的验证逻辑：

- `context.operation` 是操作名，`context.input` 是已校验的账号字段；不要再次读取请求正文。
- 返回 `undefined` 继续调用引擎，返回 JSON `Response` 结束请求；抛出异常会返回 503 并拒绝请求。
- 额外凭证可放在本站请求头，由 `context.request.headers` 读取；现有引擎正文不接受额外字段。

例如，登录或注册前要求验证码：表单取得供应商 token，通过 hook 和 `client/account-api.ts` 传入 `X-Captcha-Token` 请求头，后端调用供应商验证服务，校验通过才放行。验证码供应商的脚本、iframe 和接口来源需同步加入页面安全策略。

邮箱验证可新增本站发送与验证接口，验证成功后签发绑定邮箱、用户名和验证会话的短期一次性凭证。注册时通过 `X-Email-Verification` 请求头提交，后端核验并消费凭证后放行。引擎注册接口不保存邮箱，关联关系由服主自行保存。

模板未内置验证码或邮件供应商。新增接口需校验来源与输入、限制发送频率和尝试次数；服务端密钥在部署环境中自行配置，不放入前端。不要信任客户端传来的“已验证”布尔标记。

## 镜像部署

运行 `npm run image`，在目标 Docker 主机加载对应架构的文件，例如：

```sh
docker load -i dist/box3-player-auth-portal-1.0.0-arm64.tar.gz
```

在启动器「数据配置 → 访问设置 → 登录页面镜像」中填写 `box3-player-auth-portal:1.0.0-arm64`，保存并重启相关服务。版本号取自 `package.json`，架构按目标主机选择。

生产配置由启动器注入，包括玩家服务内部地址、引擎密钥、公开地址和路径前缀。生产服务器不读取 `.env.local`，同一镜像可用于不同部署路径。

## 常见问题

- **502 / 504**：确认玩家服务和原门户已启动，开发代理地址及其子路径正确。
- **503**：检查开发地址、生产运行配置或自定义鉴权服务。
- **页面一直加载或资源 404**：核对访问路径，重启开发服务并刷新，查看浏览器脚本和会话请求错误。
- **登录后仍未登录**：开发访问统一使用 `127.0.0.1` 或 `localhost`；生产核对公开域名、HTTPS 与 Cookie 路径。

`/api/health-check` 成功只表示门户能响应；`/api/auth/session` 成功才说明账号上游链路可用。使用子路径时，这两个地址也要加上前缀。账号操作请使用专门的测试账号。

## 许可证

[MIT](LICENSE)
