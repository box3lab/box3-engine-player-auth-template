import 'server-only';

export type AuthOperation = 'login' | 'register' | 'session' | 'logout' | 'profile' | 'password';
export type AuthOperationDefinition = Readonly<{
    method:'GET' | 'POST' | 'PATCH';
    fields:readonly string[];
}>;

const AUTH_OPERATIONS:Record<AuthOperation, AuthOperationDefinition> = {
    login: { method: 'POST', fields: ['username', 'password'] },
    register: { method: 'POST', fields: ['username', 'displayName', 'password'] },
    session: { method: 'GET', fields: [] },
    logout: { method: 'POST', fields: [] },
    profile: { method: 'PATCH', fields: ['displayName'] },
    password: { method: 'POST', fields: ['currentPassword', 'newPassword'] },
};

/**
 * 获取冻结的操作定义副本；未知名称返回 undefined。
 * 该定义仅供后端使用；前端只能依赖公开账号数据类型，不导入此操作表。
 * 增加操作时还需确认引擎提供对应接口，并更新后端校验和浏览器公开方法。
 */
export function getAuthOperation(name:string):AuthOperationDefinition | undefined {
    if (!Object.hasOwn(AUTH_OPERATIONS, name)) {
        return undefined;
    }
    const operation = AUTH_OPERATIONS[name as AuthOperation];
    return Object.freeze({ ...operation, fields: Object.freeze([...operation.fields]) });
}
