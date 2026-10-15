/** 允许浏览器展示的玩家资料，不包含密码哈希、密钥或数据库字段。 */
export type Player = { id?:string; username:string; displayName:string };
/** player 为 null 表示没有已登录会话；成功注册也不一定已登录。 */
export type Session = {
    player:Player | null;
    registrationEnabled?:boolean;
    returnUrl?:string;
};
/** 回跳仅用于导航，不能传引擎内部地址；后端会再次验证同源白名单。 */
export type Navigation = { source?:string; returnUrl?:string; transferState?:string; transferChallenge?:string };
export type Credentials = { username:string; password:string };
export type Registration = Credentials & { displayName:string };

/** 昵称与改密请求的公开输入；确认密码只属于表单，不发送到引擎。 */
export type ProfileUpdate = { displayName:string };
export type PasswordChange = { currentPassword:string; newPassword:string };
