import { randomBytes } from 'node:crypto';

/**
 * 为每次请求生成 CSP 和随机 nonce，供 Next.js 脚本与页面安全策略共同使用。
 * @param {boolean} isDevelopment
 * @param {Record<string, string | undefined>} env
 */
export function securityHeaders(isDevelopment, env = process.env) {
    const nonce = randomBytes(16).toString('base64');
    const ancestors = new Set(["'self'", 'http://tauri.localhost', 'tauri://localhost']);
    for (const raw of [env.BOX_PLAY_PUBLIC_URL, env.BOX_CREATOR_PUBLIC_URL]) {
        try {
            const url = new URL(raw);
            if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) {
                ancestors.add(url.origin);
            }
        } catch {
            /* Unconfigured origins are not authorized to embed the page. */
        }
    }
    const csp = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}'${isDevelopment ? " 'unsafe-eval'" : ''}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        `connect-src 'self'${isDevelopment ? ' ws: wss:' : ''}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        `frame-ancestors ${[...ancestors].join(' ')}`,
    ].join('; ');
    return { nonce, csp };
}
