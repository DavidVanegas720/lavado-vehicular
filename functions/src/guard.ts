import { CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { auth, db } from './firebase.js';
import { coded } from './errors.js';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
export const AllowBlocked = () => SetMetadata('allowBlocked', true);
export const Ctx = createParamDecorator((_: unknown, c: ExecutionContext) => c.switchToHttp().getRequest().ctx);

type Data = { active?: unknown; status?: unknown } | undefined;

// Pure order of the checks after the token is verified; returns an error code or null.
export function decide(
  claims: { role?: string; businessId?: string },
  business: Data,
  member: Data,
  meta: { roles?: string[]; allowBlocked?: boolean },
): string | null {
  if (!meta.roles?.length) return 'forbidden';
  if (!claims.role) return 'forbidden';
  if (claims.role === 'superadmin') return meta.roles.includes('superadmin') ? null : 'forbidden';
  if (!business || !member) return 'forbidden';
  if (member.active !== true) return 'forbidden';
  if (business.status === 'blocked' && !meta.allowBlocked) return 'business_blocked';
  return meta.roles.includes(claims.role) ? null : 'forbidden';
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(c: ExecutionContext) {
    const h = c.getHandler();
    const meta = {
      roles: this.reflector.get<string[]>('roles', h),
      allowBlocked: this.reflector.get<boolean>('allowBlocked', h),
    };
    if (!meta.roles?.length) throw coded('forbidden');
    const req = c.switchToHttp().getRequest();
    const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
    if (!m) throw coded('unauthenticated');
    let t;
    try { t = await auth.verifyIdToken(m[1]); } catch { throw coded('unauthenticated'); }
    const { role, businessId } = t as { role?: string; businessId?: string };
    let business: Data, member: Data;
    if (role && role !== 'superadmin') {
      if (!businessId) throw coded('forbidden');
      const b = db.doc('businesses/' + businessId);
      const [bs, ms] = await db.getAll(b, b.collection('members').doc(t.uid));
      business = bs.data();
      member = ms.data();
    }
    const code = decide({ role, businessId }, business, member, meta);
    if (code) throw coded(code);
    req.ctx = { uid: t.uid, role, businessId, business, member };
    return true;
  }
}
