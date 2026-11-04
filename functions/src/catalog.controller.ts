import { Controller, HttpCode, Post } from '@nestjs/common';
import { Roles, Ctx } from './guard.js';
import { tenant, plain } from './firebase.js';
import type { Ctx_ } from './shifts.controller.js';

type Read = (q: FirebaseFirestore.Query) => Promise<FirebaseFirestore.QuerySnapshot>;

// Operators see only active items, and prices only for pairs they can order (mock `visible`, D2.7). Admin sees all.
export async function readCatalog(ctx: Ctx_, read: Read) {
  const t = tenant(ctx);
  const [categories, washTypes, washers, prices] = await Promise.all(
    ['categories', 'washTypes', 'washers', 'prices'].map(async (n) => (await read(t.collection(n))).docs.map((d) => plain(d.data()))));
  if (ctx.role === 'admin') return { categories, washTypes, washers, prices };
  const active = (l: any[]) => l.filter((x) => x.active);
  const on = (l: any[], id: string) => l.some((x) => x.id === id && x.active);
  return {
    categories: active(categories), washTypes: active(washTypes), washers: active(washers),
    prices: prices.filter((p) => on(categories, p.categoryId) && on(washTypes, p.washTypeId)),
  };
}

@Controller('catalog')
export class CatalogController {
  @Post('list')
  @HttpCode(200)
  @Roles('admin', 'operator')
  list(@Ctx() ctx: Ctx_) { return readCatalog(ctx, (q) => q.get()); }
}
