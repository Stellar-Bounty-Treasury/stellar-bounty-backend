export function formatSimulationCost(resourceFeeStroops: string | number): { stroops: number; xlm: string } {
  const stroops = typeof resourceFeeStroops === 'string' ? parseInt(resourceFeeStroops, 10) : resourceFeeStroops;
  const xlm = (stroops / 10_000_000).toFixed(6);
  return { stroops, xlm };
}
