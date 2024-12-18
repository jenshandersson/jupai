export type Allocation = { [asset: string]: string };
export type Trade = { from: string; to: string; percentage: number };

export function getTrades(
  currentAllocation: Allocation,
  targetAllocation: Allocation
): Trade[] {
  const trades: Trade[] = [];
  const assets = new Set([
    ...Object.keys(currentAllocation),
    ...Object.keys(targetAllocation),
  ]);

  // Convert percentages to numbers
  const current = convertToNumbers(currentAllocation);
  const target = convertToNumbers(targetAllocation);

  // Calculate differences
  const diffs: { [asset: string]: number } = {};
  for (const asset of assets) {
    diffs[asset] = (target[asset] || 0) - (current[asset] || 0);
  }

  // Sort assets by difference
  const sortedAssets = Object.keys(diffs).sort((a, b) => diffs[a] - diffs[b]);

  let i = 0;
  let j = sortedAssets.length - 1;

  // Match negative differences with positive ones to create trades
  while (i < j) {
    const fromAsset = sortedAssets[i];
    const toAsset = sortedAssets[j];

    if (diffs[fromAsset] >= 0) break; // No more negative differences

    const amount = Math.min(-diffs[fromAsset], diffs[toAsset]);
    trades.push({
      from: fromAsset,
      to: toAsset,
      percentage: amount,
    });

    diffs[fromAsset] += amount;
    diffs[toAsset] -= amount;

    if (diffs[fromAsset] === 0) i++;
    if (diffs[toAsset] === 0) j--;
  }

  return trades;
}

function convertToNumbers(allocation: Allocation): { [asset: string]: number } {
  const result: { [asset: string]: number } = {};
  for (const [asset, value] of Object.entries(allocation)) {
    result[asset] = parseFloat(value);
  }
  return result;
}
