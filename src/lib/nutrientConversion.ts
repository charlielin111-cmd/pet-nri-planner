import { Ingredient, NutrientDefinition } from './types';

/**
 * Convert a nutrient value (in its native unit) to grams.
 * For Vitamin E (IU), uses ingredient.vitaminEType ('natural' default 0.00067, 'synthetic' 0.001).
 */
export function nutrientValueToGrams(
  nutrientId: string,
  value: number,
  unit: string,
  ingredient?: Ingredient,
): number {
  if (unit === 'g') return value;
  if (unit === 'mg') return value * 0.001;
  if (unit === 'IU') {
    if (nutrientId === 'vitamin_a') return value * 0.0000003;
    if (nutrientId === 'vitamin_d') return value * 0.000000025;
    if (nutrientId === 'vitamin_e') {
      const type = ingredient?.vitaminEType || 'synthetic';
      return value * (type === 'natural' ? 0.00067 : 0.001);
    }
  }
  return value; // fallback
}

/**
 * Compute total grams of each nutrient contributed by all ingredients in a formula.
 * Uses per-ingredient vitamin E type for correct IU->g conversion.
 */
export function computeNutrientGramTotals(
  formulaIngredients: { ingredientId: string; amount: number }[],
  ingredients: Ingredient[],
  nutrients: NutrientDefinition[],
): Record<string, number> {
  const totals: Record<string, number> = {};
  formulaIngredients.forEach(fi => {
    const ing = ingredients.find(i => i.id === fi.ingredientId);
    if (!ing) return;
    nutrients.forEach(n => {
      const val = ing.nutrients[n.id];
      if (val === 'ND' || typeof val !== 'number') return;
      // val is per 100g, fi.amount is grams
      const nutrientAmountInItsUnit = (val / 100) * fi.amount;
      const grams = nutrientValueToGrams(n.id, nutrientAmountInItsUnit, n.unit, ing);
      totals[n.id] = (totals[n.id] || 0) + grams;
    });
  });
  return totals;
}
