/** Kebab-case OpenSpec change name */
export const CHANGE_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isKebabChangeName(name: string): boolean {
  return CHANGE_NAME_RE.test(name);
}
