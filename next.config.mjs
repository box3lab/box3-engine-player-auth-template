/** @type {import('next').NextConfig} */
export default {
    assetPrefix: process.env.BOX_APP_BASE_PATH || '',
    compress: false,
    poweredByHeader: false,
    productionBrowserSourceMaps: false,
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'no-referrer' },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=()',
                    },
                ],
            },
        ];
    },
};
