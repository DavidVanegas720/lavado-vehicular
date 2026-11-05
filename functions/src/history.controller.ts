import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Roles, Ctx } from './guard.js';
import { coded } from './errors.js';
import { tenant, plain } from './firebase.js';
import { shiftOf, isoWeek, month } from './domain/shift.js';
import { parsePlate } from './domain/plate.js';
import { clock, type Ctx_ } from './shifts.controller.js';

// Plate history (E13). Cancelled orders are listed but not counted. Equality query only, so no index.
async function plateHistory(ctx: Ctx_, raw: unknown, now: Date) {
  const parsed = parsePlate(raw as string, 'motorcycle', true);
  if (!parsed) throw coded('validation');
  const t = tenant(ctx);
  const [v, snap] = await Promise.all([t.collection('vehicles').doc(parsed.plate).get(), t.collection('orders').where('plate', '==', parsed.plate).get()]);
  const { businessDate } = shiftOf(now, ctx.business.shifts);
  const week = isoWeek(businessDate);
  const mon = month(businessDate);
  const orders = snap.docs.map((d) => ({ id: d.id, ...plain(d.data()) })).sort((a, b) => b.createdAt - a.createdAt);
  const counted = orders.filter((o) => o.status !== 'cancelled');
  return {
    vehicle: v.exists ? plain(v.data()) : null,
    counts: {
      day: counted.filter((o) => o.businessDate === businessDate).length,
      week: counted.filter((o) => o.isoWeek === week).length,
      month: counted.filter((o) => o.month === mon).length,
      all: counted.length,
    },
    orders,
  };
}

@Controller('history')
export class HistoryController {
  @Post('getPlate')
  @HttpCode(200)
  @Roles('admin')
  getPlate(@Ctx() ctx: Ctx_, @Body() b: { plate?: unknown }, @Req() req: { headers: Record<string, string | string[] | undefined> }) {
    return plateHistory(ctx, b?.plate, clock(req));
  }
}
