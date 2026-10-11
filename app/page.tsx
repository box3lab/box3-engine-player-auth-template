'use client';

import { useAccount, type AccountView } from '@hooks/use-account';
import { AccountContent } from '@components/account-content';

const PAGE_TITLES = {
    login: '登录账号',
    register: '注册账号',
    overview: '玩家账号',
    profile: '修改昵称',
    password: '修改密码',
} satisfies Record<AccountView, string>;
export default function Page() {
    const account = useAccount();
    const { view, isBusy, message, show } = account;
    return (
        <main>
            <section className='card' aria-busy={isBusy}>
                <header>
                    <div className='brand'>
                        <span className='brand-mark' aria-hidden='true'>
                            ✦
                        </span>{' '}
                        BOX3
                    </div>
                    <h1>{PAGE_TITLES[view]}</h1>
                </header>
                <p className='message' role='status' aria-live='polite'>
                    {isBusy ? '正在处理，请稍候…' : message}
                </p>
                {(view === 'profile' || view === 'password') && (
                    <button className='back' disabled={isBusy} onClick={() => show('overview')}>
                        ← 返回账号
                    </button>
                )}
                <AccountContent account={account} />
            </section>
        </main>
    );
}
