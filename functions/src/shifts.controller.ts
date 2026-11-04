import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Roles, Ctx } from './guard.js';
import { coded } from './errors.js';
import { db, tenant } from './firebase.js';
import { shiftOf } from './domain/shift.js';

// The clock: an x-test-now header is honored only on the emulator (10-p8 R5 option a); in production it is ignored.
const clock = (req: { headers: Record<string, string | string[] | undefined> }) => {
  const h = req.headers['x-test-now'];
  if (!h || !process.env.FIRESTORE_EMULATOR_HOST) return new Date();
  const d = new Date(String(h));
  if (Number.isNaN(d.getTime())) throw coded('validation');
  return d;
};

type Ctx_ = { uid: string; businessId: string; business: { shifts: Parameters<typeof shiftOf>[1] } };

async function openShift(ctx: Ctx_, openingCash: unknown, now: Date) {
  if (!Number.isInteger(openingCash) || (openingCash as number) < 0) throw coded('validation');
  const cur = shiftOf(now, ctx.business.shifts);
  const events = tenant(ctx).collection('shiftEvents');
  try {
    await db.runTransaction(async (tx) => {
      if (!(await tx.get(events.where('shiftKey', '==', cur.shiftKey))).empty) throw coded('invalid_state');
      tx.create(events.doc(`${cur.shiftKey}_open`), {
        type: 'open', shiftKey: cur.shiftKey, shiftName: cur.shiftName, endsAt: cur.endsAt,
        openingCash, at: now, by: ctx.uid,
      });
    });
  } catch (e) {
    if ((e as { code?: unknown }).code === 6) throw coded('invalid_state'); // ALREADY_EXISTS: lost the race (B8)
    throw e;
  }
  return {};
}

@Controller('shifts')
export class ShiftsController {
  @Post('open')
  @HttpCode(200)
  @Roles('operator')
  open(@Ctx() ctx: Ctx_, @Body() body: { openingCash?: unknown }, @Req() req: { headers: Record<string, string | string[] | undefined> }) {
    return openShift(ctx, body?.openingCash, clock(req));
  }
}
