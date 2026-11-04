import { MOCK, api } from '../api/client.js'
import { listCatalog as mockListCatalog } from '../mocks/catalog.js'

export const listCatalog = MOCK ? mockListCatalog : api.listCatalog
export {
  listCategories, listWashTypes, listWashers, listPrices,
  createCategory, updateCategory, setCategoryActive,
  createWashType, updateWashType, setWashTypeActive, setPrice,
  createWasher, updateWasher, setWasherActive, setWasherCommissionBp,
} from '../mocks/catalog.js'
