import type { Metadata } from 'next';

import './globals.css';
import { requestTimeoutMs } from '@engine/portal-config';

export const metadata:Metadata = { title: 'BOX3 玩家账号' };
export const dynamic = 'force-dynamic';

export default function Layout({ children }:{ children:React.ReactNode }) {
    return (
        <html
            lang='zh-CN'
            data-base-path={process.env.BOX_APP_BASE_PATH || ''}
            data-auth-timeout-ms={requestTimeoutMs() + 5000}
        >
            <body>{children}</body>
        </html>
    );
}
