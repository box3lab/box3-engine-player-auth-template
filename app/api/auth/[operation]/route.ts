import { handleAccountRequest } from '@server/account-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handle(request:Request, context:{ params:Promise<{ operation:string }> }) {
    return handleAccountRequest(request, (await context.params).operation);
}
export {
    handle as GET,
    handle as POST,
    handle as PATCH,
    handle as PUT,
    handle as DELETE,
    handle as OPTIONS,
};
