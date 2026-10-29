export function truncateStellarAddress(address: string, lead = 6, tail = 4): string {
  if (!address || address.length <= lead + tail) return address;
  return `${address.slice(0, lead)}...${address.slice(-tail)}`;
}

export function isValidStellarPublicKey(key: string): boolean {
  return typeof key === 'string' && key.startsWith('G') && key.length === 56;
}
