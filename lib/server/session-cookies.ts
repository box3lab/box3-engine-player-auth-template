import 'server-only';

const PLAYER_COOKIE_NAMES = new Set(['box_local_player_session', 'box_local_player_device']);
export function isPlayerCookie(value:string):boolean {
    const separator = value.indexOf('=');
    return separator > 0 && PLAYER_COOKIE_NAMES.has(value.slice(0, separator).trim());
}
export function playerCookieHeader(value:string):string {
    return value
        .split(';')
        .map((pair) => pair.trim())
        .filter(isPlayerCookie)
        .join('; ');
}
