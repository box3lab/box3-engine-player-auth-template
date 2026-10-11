import { AccountForm } from '@components/account-form';
import { FormField } from '@components/form-field';
import { readFormText } from '@components/form-values';

import type { PasswordFormInput } from '@hooks/use-account';

/**
 * 密码表单，供服主调整展示和布局。
 * onSave 必须验证新密码与确认密码一致；成功后让玩家重新登录，不保存密码到浏览器存储。
 * 请求期间传入 isBusy；不要在组件中直接调用引擎内部接口。
 */
export function PasswordForm({
    isBusy,
    onSave,
}:{
    isBusy:boolean;
    onSave:(input:PasswordFormInput) => Promise<boolean>;
}) {
    return (
        <AccountForm
            isBusy={isBusy}
            button='修改密码'
            action={(data) =>
                onSave({
                    currentPassword: readFormText(data, 'currentPassword'),
                    newPassword: readFormText(data, 'newPassword'),
                    confirmPassword: readFormText(data, 'confirmPassword'),
                })
            }
        >
            <FormField
                label='当前密码'
                name='currentPassword'
                type='password'
                autoComplete='current-password'
            />
            <FormField
                label='新密码'
                name='newPassword'
                type='password'
                minLength={10}
                maxLength={128}
                autoComplete='new-password'
            />
            <FormField
                label='确认新密码'
                name='confirmPassword'
                type='password'
                minLength={10}
                maxLength={128}
                autoComplete='new-password'
            />
        </AccountForm>
    );
}
