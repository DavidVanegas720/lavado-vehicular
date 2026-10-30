import { ROLES } from '../domain/roles.js';
import { categories, prices, washTypes, washers } from './seed.js';
import { coded } from './errors.js';
import { requireSession } from './session.js';

const STAFF = [ROLES.ADMIN, ROLES.OPERATOR];

// The business filter for the catalog lives here. Every read goes through this function.
export function businessCatalog(businessId) {
  const own = (list) => list.filter((item) => item.businessId === businessId);
  return {
    categories: own(categories).filter((item) => item.active),
    washTypes: own(washTypes).filter((item) => item.active),
    prices: own(prices),
    washers: own(washers).filter((item) => item.active),
  };
}

export async function listCategories() {
  const { business } = requireSession(STAFF);
  return structuredClone(businessCatalog(business.id).categories);
}

export async function listWashTypes() {
  const { business } = requireSession(STAFF);
  return structuredClone(businessCatalog(business.id).washTypes);
}

export async function listPrices() {
  const { business } = requireSession(STAFF);
  return structuredClone(businessCatalog(business.id).prices);
}

// commissionHistory is audit data for admins; operators never receive it.
export async function listWashers() {
  const { business } = requireSession(STAFF);
  return structuredClone(businessCatalog(business.id).washers.map(({ commissionHistory, ...washer }) => washer));
}

export async function setWasherCommission(washerId, commissionBp) {
  const session = requireSession([ROLES.ADMIN]);
  const washer = businessCatalog(session.business.id).washers.find((item) => item.id === washerId);
  if (!washer) throw coded('not_found');
  if (!Number.isInteger(commissionBp) || commissionBp < 0 || commissionBp > 10000) {
    throw coded('validation');
  }
  // Only orders created after this call use the new rate; orders copy it at save time.
  washer.commissionHistory.push({ commissionBp, effectiveFrom: new Date(), changedBy: session.id });
  washer.commissionBp = commissionBp;
}
