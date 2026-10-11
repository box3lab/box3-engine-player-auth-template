import { createServer } from 'node:http';
import { loadEnvFile } from 'node:process';
import { StringDecoder } from 'node:string_decoder';

import { securityHeaders } from './security-headers.mjs';

const isDevelopment = process.argv.includes('--dev');
process.env.NODE_ENV = isDevelopment ? 'development' : 'production';
if (isDevelopment) {
    try {
        loadEnvFile('.env.local');
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }
    if (!process.env.BOX_DEV_AUTH_PORTAL_URL && !process.env.BOX_PLAYER_AUTH_API_KEY) {
        console.error(
            '开发联调请复制 .env.example 为 .env.local，并填写 BOX_DEV_AUTH_PORTAL_URL。',
        );
        process.exit(1);
    }
}

// 启动器注入 BOX_APP_BASE_PATH；手动部署也可从公开地址获取前缀。
const raw =
    process.argv
        .find((argument) => argument.startsWith('--base-path='))
        ?.slice('--base-path='.length) ??
    process.env.BOX_APP_BASE_PATH ??
    (process.env.BOX_AUTH_PORTAL_PUBLIC_URL
        ? new URL(process.env.BOX_AUTH_PORTAL_PUBLIC_URL).pathname
        : '');
const basePath = raw === '/' ? '' : raw.replace(/\/$/, '');
if (basePath && !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(basePath)) {
    throw new Error('BOX_APP_BASE_PATH 须为空或 /login、/accounts 这样的路径');
}
process.env.BOX_APP_BASE_PATH = basePath;
const hostname = process.env.HOST || (isDevelopment ? '127.0.0.1' : '0.0.0.0');
const port = Number(process.env.PORT || 3214);
const { default: next } = await import('next');
const app = next({
    dev: isDevelopment,
    hostname,
    port,
});
const handle = app.getRequestHandler();
await app.prepare();

function stripPrefix(request) {
    const url = new URL(request.url || '/', 'http://localhost');
    if (basePath && (url.pathname === basePath || url.pathname.startsWith(`${basePath}/`))) {
        request.url = `${url.pathname.slice(basePath.length) || '/'}${url.search}`;
    }
}

/** Next 的客户端清单包含构建时资源路径，子路径部署需同步调整 HTML 输出。 */
function prefixAssets(response) {
    const write = response.write.bind(response);
    const end = response.end.bind(response);
    const decoder = new StringDecoder('utf8');
    let pending = '';
    function transform(chunk, final = false) {
        pending += chunk ? decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)) : '';
        if (final) {
            pending += decoder.end();
        }
        pending = pending.replace(/(["'])\/_next\//g, `$1${basePath}/_next/`);
        // 保留可能跨越 chunk 边界的 URL 开头。
        const boundary = final ? pending.length : Math.max(0, pending.length - 16);
        const output = pending.slice(0, boundary);
        pending = pending.slice(boundary);
        return output;
    }
    function isHtml() {
        return String(response.getHeader('Content-Type')).includes('text/html');
    }
    response.write = (chunk, encoding, callback) => {
        if (!isHtml()) {
            return write(chunk, encoding, callback);
        }
        if (!response.headersSent) {
            response.removeHeader('Content-Length');
            response.removeHeader('ETag');
        }
        return write(transform(chunk), typeof encoding === 'function' ? encoding : callback);
    };
    response.end = (chunk, encoding, callback) => {
        if (!isHtml()) {
            return end(chunk, encoding, callback);
        }
        if (!response.headersSent) {
            response.removeHeader('Content-Length');
            response.removeHeader('ETag');
        }
        return end(transform(chunk, true), typeof encoding === 'function' ? encoding : callback);
    };
}
const server = createServer(async (request, response) => {
    // 兼容直接访问带前缀的 URL，以及启动器 Nginx 已剥离前缀的请求。
    try {
        const { nonce, csp } = securityHeaders(isDevelopment);
        request.headers['x-nonce'] = nonce;
        request.headers['content-security-policy'] = csp;
        response.setHeader('Content-Security-Policy', csp);
        if (basePath && !isDevelopment) {
            prefixAssets(response);
        }
        if (!isDevelopment) {
            stripPrefix(request);
        }
        await handle(request, response);
    } catch {
        if (!response.headersSent) {
            response.statusCode = 500;
            response.end('暂时无法处理请求');
        } else {
            response.destroy();
        }
    }
});
server.listen(port, hostname, () => {
    const localHost = ['0.0.0.0', '::'].includes(hostname) ? 'localhost' : hostname;
    const authority = localHost.includes(':') ? `[${localHost}]` : localHost;
    console.log(`BOX3 登录页面已启动\n  Local: http://${authority}:${port}${basePath}/`);
});
