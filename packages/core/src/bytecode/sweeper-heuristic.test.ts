import { describe, expect, it } from "vitest";
import type { Hex } from "viem";
import { crudeSweeperHeuristic } from "./sweeper-heuristic.js";

describe("crudeSweeperHeuristic — hand-crafted bytecode", () => {
  it("matches a non-trivial PUSH20 followed by CALL within the proximity window", () => {
    const address = "1337".repeat(10); // 20 bytes, clearly non-trivial
    const bytecode = `0x73${address}6000600060006000600060065af1` as Hex; // PUSH20 addr, then a few pushes, CALL

    const result = crudeSweeperHeuristic(bytecode);

    expect(result.matched).toBe(true);
    expect(result.address?.toLowerCase()).toBe(`0x${address}`);
  });

  it("matches SELFDESTRUCT to a hardcoded address", () => {
    const address = "dead".repeat(10);
    const bytecode = `0x73${address}ff` as Hex;
    expect(crudeSweeperHeuristic(bytecode).matched).toBe(true);
  });

  it("does not match when the pushed address is the zero address", () => {
    const bytecode = `0x73${"00".repeat(20)}f1` as Hex;
    expect(crudeSweeperHeuristic(bytecode).matched).toBe(false);
  });

  it("does not match a compiler address-mask constant (all 0xff)", () => {
    // This exact pattern — PUSH20 0xff...ff — is what solc emits for an
    // `address` type-safety AND-mask; it's not a sweep target.
    const bytecode = `0x73${"ff".repeat(20)}16f1` as Hex;
    expect(crudeSweeperHeuristic(bytecode).matched).toBe(false);
  });

  it("does not match when no CALL-family opcode ever follows the PUSH20", () => {
    const address = "1337".repeat(10);
    const bytecode = `0x73${address}600055` as Hex; // PUSH20, then just SSTORE
    expect(crudeSweeperHeuristic(bytecode).matched).toBe(false);
  });

  it("does not match once the CALL falls outside the proximity window", () => {
    const address = "1337".repeat(10);
    const filler = "60ff".repeat(30); // 30 unrelated PUSH1 instructions
    const bytecode = `0x73${address}${filler}f1` as Hex;
    expect(crudeSweeperHeuristic(bytecode).matched).toBe(false);
  });

  it("does not desync when a push's immediate data contains a byte that looks like CALL (0xf1)", () => {
    // PUSH2 0xf100 — the 0xf1 here is DATA, not a real CALL instruction —
    // followed by a trivial PUSH20 that must not spuriously match.
    const bytecode = `0x61f10073${"00".repeat(20)}` as Hex;
    expect(crudeSweeperHeuristic(bytecode).matched).toBe(false);
  });
});

describe("crudeSweeperHeuristic — real compiled fixture bytecode", () => {
  // Captured via `forge inspect src/fixtures/<Contract>.sol:<Contract>
  // deployedBytecode` (contracts/, solc 0.8.25/0.8.37 — see
  // contracts/foundry.toml). If contracts/src/fixtures/*.sol or the
  // compiler version changes, regenerate these constants the same way.
  const SWEEPER_DEPLOYED_BYTECODE: Hex =
    "0x608060405260043610610021575f3560e01c80633cbadf781461003a57610030565b366100305761002e610064565b005b610038610064565b005b348015610045575f5ffd5b5061004e6100cc565b60405161005b9190610123565b60405180910390f35b5f4790505f8111156100c957731337c0ffee1337c0ffee1337c0ffee1337c0ffee73ffffffffffffffffffffffffffffffffffffffff166108fc8290811502906040515f60405180830381858888f193505050501580156100c7573d5f5f3e3d5ffd5b505b50565b731337c0ffee1337c0ffee1337c0ffee1337c0ffee81565b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f61010d826100e4565b9050919050565b61011d81610103565b82525050565b5f6020820190506101365f830184610114565b9291505056fea26469706673582212202193eae523fa83402771bcd0a02c87c56a04f46fd24bd84fcd2c8901425de10c64736f6c63430008250033";

  const BENIGN_DEPLOYED_BYTECODE: Hex =
    "0x608060405260043610610021575f3560e01c8063b61d27f61461002c57610028565b3661002857005b5f5ffd5b348015610037575f5ffd5b50610052600480360381019061004d91906102d4565b610068565b60405161005f91906103b5565b60405180910390f35b60603073ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146100cf576040517f29c3b7ee00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f5f8673ffffffffffffffffffffffffffffffffffffffff168686866040516100f9929190610411565b5f6040518083038185875af1925050503d805f8114610133576040519150601f19603f3d011682016040523d82523d5f602084013e610138565b606091505b50915091508161017f57806040517fa5fa8d2b00000000000000000000000000000000000000000000000000000000815260040161017691906103b5565b60405180910390fd5b8673ffffffffffffffffffffffffffffffffffffffff167fcaf938de11c367272220bfd1d2baa99ca46665e7bc4d85f00adb51b90fe1fa9f8787876040516101c993929190610464565b60405180910390a28092505050949350505050565b5f5ffd5b5f5ffd5b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f61020f826101e6565b9050919050565b61021f81610205565b8114610229575f5ffd5b50565b5f8135905061023a81610216565b92915050565b5f819050919050565b61025281610240565b811461025c575f5ffd5b50565b5f8135905061026d81610249565b92915050565b5f5ffd5b5f5ffd5b5f5ffd5b5f5f83601f84011261029457610293610273565b5b8235905067ffffffffffffffff8111156102b1576102b0610277565b5b6020830191508360018202830111156102cd576102cc61027b565b5b9250929050565b5f5f5f5f606085870312156102ec576102eb6101de565b5b5f6102f98782880161022c565b945050602061030a8782880161025f565b935050604085013567ffffffffffffffff81111561032b5761032a6101e2565b5b6103378782880161027f565b925092505092959194509250565b5f81519050919050565b5f82825260208201905092915050565b8281835e5f83830152505050565b5f601f19601f8301169050919050565b5f61038782610345565b610391818561034f565b93506103a181856020860161035f565b6103aa8161036d565b840191505092915050565b5f6020820190508181035f8301526103cd818461037d565b905092915050565b5f81905092915050565b828183375f83830152505050565b5f6103f883856103d5565b93506104058385846103df565b82840190509392505050565b5f61041d8284866103ed565b91508190509392505050565b61043281610240565b82525050565b5f610443838561034f565b93506104508385846103df565b6104598361036d565b840190509392505050565b5f6040820190506104775f830186610429565b818103602083015261048a818486610438565b905094935050505056fea26469706673582212204e21d1b134acb97f6c4d57511eb7bbb8a44aa9823139a3c20b9a792a7533d6b464736f6c63430008250033";

  const PROXY_DEPLOYED_BYTECODE: Hex =
    "0x608060405236600a57005b5f60116031565b9050365f5f375f5f365f845af43d5f5f3e805f8114602d573d5ff35b3d5ffd5b5f7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc5490509056fea26469706673582212204481cc6dd296d399d9c4b32476792ee95d1d498ad1de7e532a648c81423ce82164736f6c63430008250033";

  it("matches SweeperDelegate (a real PUSH20 collector address feeding a CALL)", () => {
    const result = crudeSweeperHeuristic(SWEEPER_DEPLOYED_BYTECODE);
    expect(result.matched).toBe(true);
    expect(result.address?.toLowerCase()).toBe("0x1337c0ffee1337c0ffee1337c0ffee1337c0ffee");
  });

  it("does not match BenignDelegate (call target comes from calldata, not a hardcoded PUSH20)", () => {
    expect(crudeSweeperHeuristic(BENIGN_DEPLOYED_BYTECODE).matched).toBe(false);
  });

  it("does not match ProxyDelegate (delegatecall target comes from SLOAD, no PUSH20 at all)", () => {
    expect(crudeSweeperHeuristic(PROXY_DEPLOYED_BYTECODE).matched).toBe(false);
  });
});
