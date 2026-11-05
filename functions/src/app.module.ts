import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './guard.js';
import { SessionController } from './session.controller.js';
import { ShiftsController } from './shifts.controller.js';
import { CatalogController } from './catalog.controller.js';
import { OrdersController } from './orders.controller.js';
import { WasherPayController } from './washerPay.controller.js';
import { OperatorsController } from './operators.controller.js';
import { HistoryController } from './history.controller.js';
import { CashFlowController } from './cashFlow.controller.js';

@Module({ controllers: [SessionController, ShiftsController, CatalogController, OrdersController, WasherPayController, OperatorsController, HistoryController, CashFlowController], providers: [{ provide: APP_GUARD, useClass: AuthGuard }] })
export class AppModule {}
