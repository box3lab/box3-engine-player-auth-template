import { AccountOverview } from '@components/account-overview';
import { LoginForm } from '@components/login-form';
import { RegisterForm } from '@components/register-form';
import { ProfileForm } from '@components/profile-form';
import { PasswordForm } from '@components/password-form';

import type { AccountController } from '@hooks/use-account';

/** 按当前视图展示账号内容，操作与会话状态由 useAccount 管理。 */
export function AccountContent({ account }:{ account:AccountController }) {
    const { session, view, isBusy, show } = account;

    switch (view) {
        case 'login':
            return (
                <>
                    <LoginForm isBusy={isBusy} onLogin={account.login} />
                    {session.registrationEnabled !== false && (
                        <button
                            className='secondary'
                            disabled={isBusy}
                            onClick={() => show('register')}
                        >
                            没有账号，去注册
                        </button>
                    )}
                </>
            );
        case 'register':
            return (
                <>
                    <RegisterForm isBusy={isBusy} onRegister={account.register} />
                    <button className='secondary' disabled={isBusy} onClick={() => show('login')}>
                        已有账号，去登录
                    </button>
                </>
            );
        case 'overview':
            return session.player ? (
                <AccountOverview
                    player={session.player}
                    isBusy={isBusy}
                    returnUrl={session.returnUrl}
                    onProfile={() => show('profile')}
                    onPassword={() => show('password')}
                    onLogout={account.logout}
                />
            ) : null;
        case 'profile':
            return session.player ? (
                <ProfileForm
                    isBusy={isBusy}
                    displayName={session.player.displayName}
                    onSave={account.updateProfile}
                />
            ) : null;
        case 'password':
            return <PasswordForm isBusy={isBusy} onSave={account.changePassword} />;
    }
}
