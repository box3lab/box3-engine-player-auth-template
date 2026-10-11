import { AccountForm, Field, value } from '@components/account-form';
import type { Registration } from '@shared/account-types';

/**
 * 注册表单，供服主调整展示和布局。
 * onRegister 负责确认密码校验；建议使用 useAccount().register，勿将确认密码直接发给 accounts API。
 * 请求期间传入 isBusy；不要在组件中直接调用引擎内部接口。
 */
export function RegisterForm({
    isBusy,
    onRegister,
}:{
    isBusy:boolean;
    onRegister:(input:Registration & { confirmPassword:string }) => Promise<boolean>;
}) {
    return (
        <AccountForm
            isBusy={isBusy}
            button='创建账号'
            action={(data) =>
                onRegister({
                    username: value(data, 'username'),
                    displayName: value(data, 'displayName'),
                    password: value(data, 'password'),
                    confirmPassword: value(data, 'confirmPassword'),
                })
            }
        >
            <Field
                label='玩家账号'
                name='username'
                placeholder='输入你的玩家账号'
                maxLength={32}
                pattern='[A-Za-z][A-Za-z0-9_]{2,31}'
                autoComplete='username'
            />
            <Field label='昵称' name='displayName' maxLength={32} autoComplete='nickname' />
            <Field
                label='密码'
                name='password'
                type='password'
                placeholder='设置至少 10 位密码'
                minLength={10}
                maxLength={128}
                autoComplete='new-password'
            />
            <Field
                label='确认密码'
                name='confirmPassword'
                type='password'
                minLength={10}
                maxLength={128}
                autoComplete='new-password'
            />
        </AccountForm>
    );
}
