import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';

export function coded(code: string, message = code) {
  return Object.assign(new Error(message), { code });
}

const STATUS: Record<string, number> = {
  unauthenticated: 401, forbidden: 403, business_blocked: 403, not_found: 404, validation: 400,
};

@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const code = (err as { code?: unknown })?.code;
    if (typeof code === 'string') return res.status(STATUS[code] ?? 409).json({ code });
    if (err instanceof HttpException) return res.status(err.getStatus()).json({ code: 'internal' });
    console.error('internal error', err instanceof Error ? err.stack : err); // never the request body
    return res.status(500).json({ code: 'internal' });
  }
}
