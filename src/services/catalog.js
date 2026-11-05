import { MOCK, api } from '../api/client.js'
import * as mock from '../mocks/catalog.js'

export const {
  listCatalog, createCategory, updateCategory, setCategoryActive,
  createWashType, updateWashType, setWashTypeActive, setPrice,
  createWasher, updateWasher, setWasherActive,
} = MOCK ? mock : api
