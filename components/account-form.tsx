import type { ReactNode } from 'react';

/** 表单动作应返回是否成功；false 会保留输入，供玩家检查并重试。 */
export type FormAction = (data:FormData) => Promise<boolean>;
/**
 * 统一表单提交和忙碌状态，不处理具体账号业务。
 * action 接收本次提交的 FormData，应自行处理错误或使用 useAccount 的操作。
 * action 成功才重置表单；传入 isBusy 可禁用输入，避免重复提交。
 * 不要在 action 中记录包含密码的完整 FormData。
 */
export function AccountForm({
    isBusy,
    action,
    button,
    children,
}:{
    isBusy:boolean;
    action:FormAction;
    button:string;
    children:ReactNode;
}) {
    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                if (isBusy) {
                    return;
                }
                const form = event.currentTarget;
                void action(new FormData(form)).then((success) => {
                    if (success) {
                        form.reset();
                    }
                });
            }}
        >
            <fieldset disabled={isBusy}>
                {children}
                <button>{isBusy ? '正在处理…' : button}</button>
            </fieldset>
        </form>
    );
}
