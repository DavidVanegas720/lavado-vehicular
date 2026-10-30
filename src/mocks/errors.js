export function coded(code, message = code) {
  return Object.assign(new Error(message), { code });
}
