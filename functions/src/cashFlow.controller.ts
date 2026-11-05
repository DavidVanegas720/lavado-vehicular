import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AggregateField } from 'firebase-admin/firestore';
import { Roles, Ctx } from './guard.js';
import { coded } from './errors.js';
import { tenant } from './firebase.js';
import { payPeriodOf } from './domain/washerPay.js';
import type { Ctx_ } from './shifts.controller.js';

// E10: money sums are sum() aggregates. Outflows of the period are read (docs of one period) to split till / outside / corrections.
async function cashFlow(ctx: Ctx_, body: { periodType?: unknown; businessDate?: unknown }) {
  if (typeof body?.businessDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.businessDate)) throw coded('validation');
  const period = payPeriodOf(body.businessDate, body.periodType as any); // throws validation on a bad periodType
  const orders = tenant(ctx).collection('orders');
  const pays = tenant(ctx).collection('washerPayments');
  const sales = (method: string) => orders.where('status', '==', 'done').where('paymentMethod', '==', method)
    .where('businessDate', '>=', period.start).where('businessDate', '<=', period.end).aggregate({ s: AggregateField.sum('finalPrice') }).get();
  const [cash, qr, earned, paid, inside] = await Promise.all([
    sales('cash'), sales('qr'),
    orders.where('status', '==', 'done').where('businessDate', '<=', period.end).aggregate({ s: AggregateField.sum('commissionAmount') }).get(),
    pays.where('businessDate', '<=', period.end).aggregate({ s: AggregateField.sum('amount') }).get(),
    pays.where('businessDate', '>=', period.start).where('businessDate', '<=', period.end).get(),
  ]);
  const entries = inside.docs.map((d) => d.data());
  const out = (f: (p: FirebaseFirestore.DocumentData) => boolean) => entries.filter(f).reduce((s, p) => s + p.amount, 0);
  const [c, q] = [cash.data().s as number, qr.data().s as number];
  const till = out((p) => p.type === 'payment' && p.source === 'till');
  const outside = out((p) => p.type === 'payment' && p.source === 'outside');
  return {
    period, in: { cash: c, qr: q, total: c + q }, out: { till, outside, total: till + outside },
    corrections: out((p) => p.type === 'correction'), owed: (earned.data().s as number) - (paid.data().s as number),
  };
}

@Controller('cashFlow')
export class CashFlowController {
  @Post('get')
  @HttpCode(200)
  @Roles('admin')
  get(@Ctx() ctx: Ctx_, @Body() b: { periodType?: unknown; businessDate?: unknown }) { return cashFlow(ctx, b); }
}
