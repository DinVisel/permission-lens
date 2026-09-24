/**
 * Fetches runtime bytecode for a set of addresses, deduplicated, with
 * bounded concurrency. Addresses with no code (an EOA, or one that never
 * got deployed to) map to `"0x"` rather than being omitted, so callers can
 * tell "no code" apart from "not fetched".
 *
 * @param {{
 *   client: import("viem").PublicClient,
 *   addresses: string[],
 *   blockNumber?: bigint,
 *   concurrency?: number,
 * }} opts
 * @returns {Promise<Map<string, `0x${string}`>>}
 */
export async function fetchBytecodeForAddresses({ client, addresses, blockNumber, concurrency = 8 }) {
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];
  const result = new Map();

  for (let i = 0; i < unique.length; i += concurrency) {
    const chunk = unique.slice(i, i + concurrency);
    const codes = await Promise.all(
      chunk.map(async (address) => {
        try {
          const code = await client.getCode({ address: /** @type {`0x${string}`} */ (address), blockNumber });
          return code ?? "0x";
        } catch (err) {
          console.error(`census: failed to fetch code for ${address}: ${/** @type {Error} */ (err).message}`);
          return "0x";
        }
      }),
    );
    chunk.forEach((address, idx) => result.set(address, codes[idx]));
  }

  return result;
}
