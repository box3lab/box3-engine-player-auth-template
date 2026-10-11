import { AccountForm } from '@components/account-form';
import { FormField } from '@components/form-field';
import { readFormText } from '@components/form-values';

import type { Credentials } from '@shared/account-types';

/**
 * 登录表单，供服主调整展示和布局。
 * onLogin 接收账号和密码并返回是否成功；建议直接传 useAccount().login。
 * 请求期间传入 isBusy；不要在组件中直接调用引擎内部接口。
 */
export function LoginForm({
    isBusy,
    onLogin,
}:{
    isBusy:boolean;
    onLogin:(input:Credentials) => Promise<boolean>;
}) {
    return (
        <AccountForm
            isBusy={isBusy}
            button='登录并继续'
            action={(data) =>
                onLogin({
                    username: readFormText(data, 'username'),
                    password: readFormText(data, 'password'),
                })
            }
        >
            <FormField
                label='玩家账号'
                name='username'
                placeholder='输入你的玩家账号'
                maxLength={32}
                autoComplete='username'
            />
            <FormField
                label='密码'
                name='password'
                type='password'
                placeholder='输入密码'
                maxLength={128}
                autoComplete='current-password'
            />
        </AccountForm>
    );
}
