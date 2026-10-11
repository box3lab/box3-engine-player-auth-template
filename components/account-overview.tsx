import type { Player } from '@shared/account-types';

/**
 * 账号概览，供服主调整展示和布局。
 * 传入已验证会话中的 player；returnUrl 必须来自后端白名单结果，不能直接使用浏览器查询参数。
 * 请求期间传入 isBusy；不要在组件中直接调用引擎内部接口。
 */
export function AccountOverview({
    player,
    isBusy,
    returnUrl,
    onProfile,
    onPassword,
    onLogout,
}:{
    player:Player;
    isBusy:boolean;
    returnUrl?:string;
    onProfile:() => void;
    onPassword:() => void;
    onLogout:() => Promise<boolean>;
}) {
    return (
        <>
            <div className='account-summary'>
                <span className='avatar' aria-hidden='true'>
                    {(player.displayName || player.username).slice(0, 1)}
                </span>
                <div>
                    <strong>{player.displayName}</strong>
                    <small>{player.username}</small>
                </div>
            </div>
            {returnUrl && (
                <a className='button' href={returnUrl}>
                    继续
                </a>
            )}
            <div className='account-actions'>
                <button className='setting' disabled={isBusy} onClick={onProfile}>
                    修改昵称 <span aria-hidden='true'>›</span>
                </button>
                <button className='setting' disabled={isBusy} onClick={onPassword}>
                    修改密码 <span aria-hidden='true'>›</span>
                </button>
            </div>
            <button className='secondary' disabled={isBusy} onClick={() => void onLogout()}>
                退出登录
            </button>
        </>
    );
}
