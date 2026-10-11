import { AccountForm, Field, value } from '@components/account-form';

/**
 * 昵称表单，供服主调整展示和布局。
 * displayName 用于初始展示；onSave 成功后应同步玩家资料。此表单不支持更改登录用户名。
 * 请求期间传入 isBusy；不要在组件中直接调用引擎内部接口。
 */
export function ProfileForm({
    isBusy,
    displayName,
    onSave,
}:{
    isBusy:boolean;
    displayName:string;
    onSave:(input:{ displayName:string }) => Promise<boolean>;
}) {
    return (
        <AccountForm
            isBusy={isBusy}
            button='保存昵称'
            action={(data) => onSave({ displayName: value(data, 'displayName') })}
        >
            <Field
                label='昵称'
                name='displayName'
                defaultValue={displayName}
                maxLength={32}
                autoComplete='nickname'
            />
        </AccountForm>
    );
}
