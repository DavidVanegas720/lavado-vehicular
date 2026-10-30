import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlate, validatePlate } from '../../src/domain/plate.js';
import { categoryForCc } from '../../src/domain/displacement.js';
import { calculateCommission } from '../../src/domain/commission.js';
import { formatCOP } from '../../src/domain/money.js';
import { businessDay } from '../../src/domain/businessDay.js';

test('plates are normalized and validated per vehicle type', () => {
  assert.equal(normalizePlate(' abc-12 d '), 'ABC12D');
  assert.equal(validatePlate('ABC12D', 'motorcycle'), true);
  assert.equal(validatePlate('ABC12', 'motorcycle'), true);
  assert.equal(validatePlate('ABC123', 'motorcycle'), false);
  assert.equal(validatePlate('ABC123', 'car'), true);
});

test('cc maps to the category whose range contains it, or to none', () => {
  const categories = [
    { id: 'a', ccMin: 1, ccMax: 125 },
    { id: 'b', ccMin: 126, ccMax: 200 },
  ];
  assert.equal(categoryForCc(150, categories).id, 'b');
  assert.equal(categoryForCc(125, categories).id, 'a');
  assert.equal(categoryForCc(400, categories), null);
});

test('commission is integer math on the list price, rounded half up', () => {
  assert.equal(calculateCommission(25000, 4000), 10000);
  assert.equal(calculateCommission(25000, 5000), 12500);
  assert.equal(calculateCommission(25001, 4000), 10000);
  assert.equal(calculateCommission(25001, 5000), 12501);
  assert.throws(() => calculateCommission(25000.5, 4000), TypeError);
});

test('money is shown in COP without decimals', () => {
  assert.match(formatCOP(25000), /25\.000/);
});

test('the operating day is the Bogotá calendar day', () => {
  // 03:00 UTC is 22:00 the previous day in Bogotá (UTC-5, no DST).
  assert.equal(businessDay(new Date('2026-10-30T03:00:00Z')), '2026-10-29');
});
