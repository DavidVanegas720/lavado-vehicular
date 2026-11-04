import { Controller, HttpCode, Post } from '@nestjs/common';
import { AllowBlocked, Ctx, Roles } from './guard.js';

@Controller('session')
export class SessionController {
  // Fields picked one by one, never a spread of a document (09 §9).
  @Post('get')
  @HttpCode(200)
  @Roles('superadmin', 'admin', 'operator')
  @AllowBlocked()
  get(@Ctx() ctx: { uid: string; role: string; businessId?: string; business?: Record<string, unknown>; member?: Record<string, unknown> }) {
    return {
      uid: ctx.uid,
      role: ctx.role,
      name: ctx.member?.name ?? null,
      businessId: ctx.businessId ?? null,
      businessName: ctx.business?.name ?? null,
      enabledVehicleTypes: ctx.business?.enabledVehicleTypes ?? [],
      businessBlocked: ctx.business?.status === 'blocked',
    };
  }
}
