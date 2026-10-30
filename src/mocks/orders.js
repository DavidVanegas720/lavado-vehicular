import { ROLES } from '../domain/roles.js';
import { normalizePlate, validatePlate } from '../domain/plate.js';
import { calculateCommission } from '../domain/commission.js';
import { PAYMENT_METHODS } from '../domain/payment.js';
import { businessDay } from '../domain/businessDay.js';
import { coded } from './errors.js';
import { requireSession } from './session.js';
import { businessCatalog } from './catalog.js';

const STAFF = [ROLES.ADMIN, ROLES.OPERATOR];
const orders = [];

// The order copies every value it needs. Later catalog or commission changes never touch it.
export async function createOrder(input) {
  const session = requireSession(STAFF);
  const catalog = businessCatalog(session.business.id);

  const plate = normalizePlate(input.plate);
  if (!validatePlate(plate, 'motorcycle')) throw coded('validation', 'invalid plate');
  if (!Number.isInteger(input.cc) || input.cc < 1) throw coded('validation', 'invalid cc');
  if (!Object.hasOwn(PAYMENT_METHODS, input.paymentMethod)) throw coded('validation', 'invalid payment method');

  if (!input.categoryId || !input.washTypeId || !input.washerId) throw coded('validation', 'missing selection');

  const category = catalog.categories.find((item) => item.id === input.categoryId);
  if (!category) throw coded('not_found', 'category');
  if (input.cc < category.ccMin || input.cc > category.ccMax) throw coded('category_mismatch');

  const washType = catalog.washTypes.find((item) => item.id === input.washTypeId);
  const price = catalog.prices.find(
    (item) => item.categoryId === category.id && item.washTypeId === input.washTypeId,
  );
  const washer = catalog.washers.find((item) => item.id === input.washerId);
  if (!washType || !price || !washer) throw coded('not_found', 'wash type, price or washer');

  const isCourtesy = input.isCourtesy === true;
  const courtesyReason = String(input.courtesyReason ?? '').trim();
  if (isCourtesy && !courtesyReason) throw coded('courtesy_reason_required');

  const listPrice = price.amount;
  const now = new Date();
  const order = {
    id: crypto.randomUUID(),
    businessId: session.business.id,
    plate,
    vehicleType: 'motorcycle',
    cc: input.cc,
    categoryId: category.id,
    categoryName: category.name,
    ccMin: category.ccMin,
    ccMax: category.ccMax,
    washTypeId: washType.id,
    washTypeName: washType.name,
    listPrice,
    finalPrice: isCourtesy ? 0 : listPrice,
    isCourtesy,
    courtesyReason: isCourtesy ? courtesyReason : '',
    washerId: washer.id,
    washerName: washer.name,
    commissionBp: washer.commissionBp,
    // Commission is always on the list price, even for courtesies.
    commissionAmount: calculateCommission(listPrice, washer.commissionBp),
    paymentMethod: input.paymentMethod,
    status: 'completed',
    createdBy: session.id,
    createdAt: now,
    businessDate: businessDay(now),
  };
  orders.push(order);
  return structuredClone(order);
}

// Operators see their own orders for today; admins see the whole business for today.
export async function listTodayOrders() {
  const session = requireSession(STAFF);
  const today = businessDay(new Date());
  return structuredClone(
    orders.filter(
      (order) =>
        order.businessId === session.business.id &&
        order.businessDate === today &&
        (session.role === ROLES.ADMIN || order.createdBy === session.id),
    ),
  );
}
