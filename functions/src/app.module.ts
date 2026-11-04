import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './guard.js';
import { SessionController } from './session.controller.js';
import { ShiftsController } from './shifts.controller.js';

@Module({ controllers: [SessionController, ShiftsController], providers: [{ provide: APP_GUARD, useClass: AuthGuard }] })
export class AppModule {}
