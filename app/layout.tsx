import type { Metadata } from 'next';
import { headers } from 'next/headers';

import './globals.css';
import { requestTimeoutMs } from '@engine/portal-config';

export const metadata:Metadata = { title: 'BOX3 玩家账号' };
export const dynamic = 'force-dynamic';

export default async function Layout({ children }:{ children:React.ReactNode }) {
    const basePath = process.env.BOX_APP_BASE_PATH || '';
    const nonce = (await headers()).get('x-nonce') || undefined;
    return (
        <html
            lang='zh-CN'
            data-base-path={basePath}
            data-auth-timeout-ms={requestTimeoutMs() + 5000}
        >
            <head>
                {/* Chunk registration must use the same runtime prefix as the HTML asset URLs. */}
                <script
                    nonce={nonce}
                    dangerouslySetInnerHTML={{
                        __html: `globalThis.TURBOPACK_CHUNK_BASE_PATH=${JSON.stringify(`${basePath}/_next/`)};`,
                    }}
                />
            </head>
            <body>{children}</body>
        </html>
    );
}
