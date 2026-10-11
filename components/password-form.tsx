import { AccountForm, Field, value } from '@components/account-form';

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
    onSave:(input:{
        currentPassword:string;
        newPassword:string;
        confirmPassword:string;
    }) => Promise<boolean>;
}) {
    return (
        <AccountForm
            isBusy={isBusy}
            button='修改密码'
            action={(data) =>
                onSave({
                    currentPassword: value(data, 'currentPassword'),
                    newPassword: value(data, 'newPassword'),
                    confirmPassword: value(data, 'confirmPassword'),
                })
            }
        >
            <Field
                label='当前密码'
                name='currentPassword'
                type='password'
                autoComplete='current-password'
            />
            <Field
                label='新密码'
                name='newPassword'
                type='password'
                minLength={10}
                maxLength={128}
                autoComplete='new-password'
            />
            <Field
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
