import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
import { Roles, Ctx } from './guard.js';
import { coded } from './errors.js';
import { auth, tenant } from './firebase.js';
import type { Ctx_ } from './shifts.controller.js';

type Doc = FirebaseFirestore.DocumentData;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const name = (v: unknown) => {
  const n = typeof v === 'string' ? v.trim() : '';
  if (n.length < 1 || n.length > 60) throw coded('validation');
  return n;
};
const view = (id: string, m: Doc) => ({ id, name: m.name, active: m.active, email: m.email ?? null });

// E7: the target must be an operator of this tenant; anything else (other tenant, admin, unknown) is not_found.
async function own(ctx: Ctx_, id: unknown) {
  if (typeof id !== 'string' || !id || id.includes('/')) throw coded('not_found');
  const ref = tenant(ctx).collection('members').doc(id);
  const m = (await ref.get()).data();
  if (!m || m.role !== 'operator') throw coded('not_found');
  return { ref, m };
}

// E6: Auth user, then claims, then the members doc; a failure after createUser removes the Auth user again.
async function create(ctx: Ctx_, b: Doc) {
  const n = name(b.name);
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!EMAIL.test(email) || email.length > 254) throw coded('validation');
  if (typeof b.password !== 'string' || b.password.length < 8 || b.password.length > 128) throw coded('validation');
  let uid: string;
  try {
    uid = (await auth.createUser({ email, password: b.password })).uid;
  } catch (e) {
    if ((e as { code?: string }).code === 'auth/email-already-exists') throw coded('email_taken');
    throw e;
  }
  try {
    await auth.setCustomUserClaims(uid, { role: 'operator', businessId: ctx.businessId });
    const m = { name: n, role: 'operator', active: true, email, createdAt: Timestamp.now(), createdBy: ctx.uid };
    await tenant(ctx).collection('members').doc(uid).create(m);
    return view(uid, m);
  } catch (e) {
    await auth.deleteUser(uid).catch(() => {}); // best effort; see plan 12 "Not done / risk"
    console.error('operators/create failed after createUser', e instanceof Error ? e.message : e);
    throw coded('internal');
  }
}

@Controller('operators')
export class OperatorsController {
  @Post('list') @HttpCode(200) @Roles('admin')
  async list(@Ctx() ctx: Ctx_) {
    const s = await tenant(ctx).collection('members').where('role', '==', 'operator').get();
    return s.docs.map((d) => view(d.id, d.data()));
  }

  @Post('create') @HttpCode(200) @Roles('admin')
  create(@Ctx() ctx: Ctx_, @Body() b: Doc) { return create(ctx, b ?? {}); }

  @Post('rename') @HttpCode(200) @Roles('admin')
  async rename(@Ctx() ctx: Ctx_, @Body() b: Doc) {
    const { ref, m } = await own(ctx, b?.id);
    const n = name(b.name);
    await ref.update({ name: n });
    return view(ref.id, { ...m, name: n });
  }

  @Post('setActive') @HttpCode(200) @Roles('admin')
  async setActive(@Ctx() ctx: Ctx_, @Body() b: Doc) {
    const { ref, m } = await own(ctx, b?.id);
    if (typeof b.active !== 'boolean') throw coded('validation');
    await ref.update({ active: b.active });
    try { await auth.updateUser(ref.id, { disabled: !b.active }); } catch (e) {
      console.error('operators/setActive: Auth update failed', e instanceof Error ? e.message : e);
      throw coded('internal'); // members already decides; the admin repeats the toggle
    }
    return view(ref.id, { ...m, active: b.active });
  }
}
