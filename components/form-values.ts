/** 读取本次提交的文本字段；缺失字段返回空字符串，供后端统一校验。 */
export function readFormText(data:FormData, field:string):string {
    const value = data.get(field);
    return typeof value === 'string' ? value : '';
}
