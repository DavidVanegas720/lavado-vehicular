import { MOCK, api } from '../api/client.js'
import { listCatalog as mockListCatalog } from '../mocks/catalog.js'

export const listCatalog = MOCK ? mockListCatalog : api.listCatalog
export {
  createCategory, updateCategory, setCategoryActive,
  createWashType, updateWashType, setWashTypeActive, setPrice,
  createWasher, updateWasher, setWasherActive,
} from '../mocks/catalog.js'
