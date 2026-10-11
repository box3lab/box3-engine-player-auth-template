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

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
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

## 镜像部署

运行 `npm run image` 后，在目标 Docker 主机加载对应架构的文件，例如：

```sh
docker load -i dist/box3-player-auth-portal-1.0.0-arm64.tar.gz
```

在启动器的「数据配置 → 访问设置 → 登录页面镜像」中填写对应镜像名，例如 `box3-player-auth-portal:1.0.0-arm64`，保存并重启相关服务。版本号取自 `package.json`。

生产配置由启动器注入，包括玩家服务内部地址、引擎密钥、公开地址和路径前缀；生产服务不读取 `.env.local`。

## 许可证

[MIT](LICENSE)
