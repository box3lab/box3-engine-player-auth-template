import { useEffect, useRef, useState } from 'react';

import { accounts } from '@client/account-api';

import type {
    Credentials,
    Registration,
    Session,
    PasswordChange,
    ProfileUpdate,
} from '@shared/account-types';

export type RegistrationFormInput = Registration & { confirmPassword:string };
export type PasswordFormInput = PasswordChange & { confirmPassword:string };

export type AccountView = 'login' | 'register' | 'overview' | 'profile' | 'password';
function readNavigation() {
    const query = new URLSearchParams(window.location.search);
    return {
        source: query.get('source') || '',
        returnUrl: query.get('returnUrl') || '',
        transferState: query.get('transferState') || '',
        transferChallenge: query.get('transferChallenge') || '',
    };
}
/**
 * 给服主 React 页面使用的账号流程 hook；必须在客户端组件顶层调用。
 * 首次挂载自动查询会话；各账号操作统一处理加载状态和错误提示。
 *
 * @returns session 为公开会话；view 为当前页面；isBusy 表示正在请求。
 * message 可放到 role="status" 的提示区；show(view) 只切换界面，不执行鉴权。
 * 六个操作返回 Promise<boolean>：true 表示成功，false 表示失败或重复提交被拦截。
 * login/register 成功后选择账号概览；退出及改密成功后返回登录页。
 * 注意：不要另行保存密码或 Cookie；页面权限不能替代引擎的会话校验。
 *
 * @example
 * const account = useAccount();
 * const success = await account.updateProfile({ displayName });
 * if (success) { console.info('昵称已更新'); }
 */
export function useAccount() {
    const [session, setSession] = useState<Session>({ player: null });
    const [view, setView] = useState<AccountView>('login');
    const [isBusy, setBusy] = useState(true);
    const [message, setMessage] = useState('');
    const isPending = useRef(false);
    const isMounted = useRef(true);
    function show(view:AccountView) {
        setView(view);
        setMessage('');
    }
    async function run(action:() => Promise<void>):Promise<boolean> {
        if (isPending.current) {
            return false;
        }
        isPending.current = true;
        setBusy(true);
        setMessage('');
        try {
            await action();
            return true;
        } catch (error) {
            if (isMounted.current) {
                setMessage(
                    error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
                        ? '请求超时，请稍后重试'
                        : error instanceof Error
                          ? error.message
                          : '请求失败，请稍后重试',
                );
            }
            return false;
        } finally {
            isPending.current = false;
            if (isMounted.current) {
                setBusy(false);
            }
        }
    }
    useEffect(() => {
        isMounted.current = true;
        void run(async () => {
            const result = await accounts.session(readNavigation());
            if (isMounted.current) {
                if (result.player && result.returnUrl && readNavigation().transferState) {
                    window.location.assign(result.returnUrl);
                    return;
                }
                setSession(result);
                setView(result.player ? 'overview' : 'login');
            }
        });
        return () => {
            isMounted.current = false;
        };
    }, []);
    function applySession(result:Session) {
        if (result.player && result.returnUrl && readNavigation().transferState) {
            window.location.assign(result.returnUrl);
            return;
        }
        setSession((current) => ({ ...current, ...result }));
        setView(result.player ? 'overview' : 'login');
    }
    return {
        session,
        view,
        isBusy,
        message,
        /** 仅切换界面并清空提示；不能用于绕过登录或修改服务端会话。 */
        show,
        /** 提交账号和密码；自动携带页面查询参数中的安全回跳信息。 */
        login: (input:Credentials) =>
            run(async () => {
                applySession(await accounts.login({ ...input, ...readNavigation() }));
            }),
        /** 先确认两次密码一致，再注册；confirmPassword 不会发送到后端。 */
        register: (input:RegistrationFormInput) =>
            run(async () => {
                if (input.password !== input.confirmPassword) {
                    throw new Error('两次密码不一致');
                }
                const { confirmPassword, ...registration } = input;
                const result = await accounts.register({
                    ...registration,
                    ...readNavigation(),
                });
                applySession(result);
                if (!result.player) {
                    setMessage('注册成功，请登录');
                }
            }),
        /** 服务端退出成功后才清空本地玩家展示。 */
        logout: () =>
            run(async () => {
                await accounts.logout();
                setSession((current) => ({ ...current, player: null }));
                show('login');
            }),
        /** 更新昵称并同步 player，成功后返回概览。 */
        updateProfile: (input:ProfileUpdate) =>
            run(async () => {
                const result = await accounts.updateProfile(input);
                setSession((current) => ({ ...current, player: result.player }));
                show('overview');
                setMessage('昵称已保存');
            }),
        /** 校验确认密码并改密，成功后清空玩家展示并提示重新登录。 */
        changePassword: (input:PasswordFormInput) =>
            run(async () => {
                if (input.newPassword !== input.confirmPassword) {
                    throw new Error('两次新密码不一致');
                }
                await accounts.changePassword({
                    currentPassword: input.currentPassword,
                    newPassword: input.newPassword,
                });
                setSession((current) => ({ ...current, player: null }));
                show('login');
                setMessage('密码已修改，请重新登录');
            }),
    };
}

/** 页面和视图组件依赖的账号控制器类型。 */
export type AccountController = ReturnType<typeof useAccount>;
