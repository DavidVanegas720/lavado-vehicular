import { ref } from 'vue';
import { defineStore } from 'pinia';
import * as catalogService from '../services/catalog.js';
import * as orderService from '../services/orders.js';

export const useWashesStore = defineStore('washes', () => {
  const categories = ref([]);
  const washTypes = ref([]);
  const prices = ref([]);
  const washers = ref([]);

  async function load() {
    [categories.value, washTypes.value, prices.value, washers.value] = await Promise.all([
      catalogService.listCategories(),
      catalogService.listWashTypes(),
      catalogService.listPrices(),
      catalogService.listWashers(),
    ]);
  }

  function priceOf(categoryId, washTypeId) {
    return prices.value.find((p) => p.categoryId === categoryId && p.washTypeId === washTypeId)?.amount ?? null;
  }

  function save(input) {
    return orderService.createOrder(input);
  }

  return { categories, washTypes, washers, load, priceOf, save };
});
