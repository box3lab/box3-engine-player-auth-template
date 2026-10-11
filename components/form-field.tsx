import type { InputHTMLAttributes } from 'react';

/** 必填的带标签输入框；可通过 required={false} 改为可选字段。 */
export function FormField({
    label,
    ...input
}:InputHTMLAttributes<HTMLInputElement> & { label:string }) {
    return (
        <label>
            {label}
            <input required {...input} />
        </label>
    );
}
