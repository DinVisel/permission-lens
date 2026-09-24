// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {Vm} from "forge-std/Vm.sol";
import {BenignDelegate} from "../src/fixtures/BenignDelegate.sol";
import {SweeperDelegate} from "../src/fixtures/SweeperDelegate.sol";
import {ProxyDelegate} from "../src/fixtures/ProxyDelegate.sol";
import {FixtureImplementation} from "../src/fixtures/FixtureImplementation.sol";

// Signs EIP-7702 authorizations to each fixture delegate and writes them to
// contracts/generated/<case>.json. Run with:
//   forge script script/GenerateFixtures.s.sol -vvv
// then `node scripts/build-fixtures.mjs` (repo root) turns these into the
// input.json/expected.json golden pairs under fixtures/7702/. See
// contracts/README.md.
contract GenerateFixtures is Script {
    // Anvil's well-known default account #0 — the same key used in
    // packages/core's own tests, so decoded `grantor` addresses match across
    // the TS and Solidity sides.
    uint256 constant AUTHORITY_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    function run() external {
        BenignDelegate benign = new BenignDelegate();
        SweeperDelegate sweeper = new SweeperDelegate();
        FixtureImplementation impl = new FixtureImplementation();
        ProxyDelegate proxy = new ProxyDelegate(address(impl));

        vm.chainId(1);
        _write("benign-chain-scoped", vm.signDelegation(address(benign), AUTHORITY_PK, uint64(0)), 1);
        _write("proxy-chain-scoped", vm.signDelegation(address(proxy), AUTHORITY_PK, uint64(0)), 1);

        // crossChain = true signs chainId = 0 ("valid on every chain") —
        // the higher-risk combination this fixture is meant to exercise.
        _write("sweeper-all-chains", vm.signDelegation(address(sweeper), AUTHORITY_PK, true), 0);
    }

    function _write(string memory caseName, Vm.SignedDelegation memory sig, uint256 chainId) internal {
        string memory obj = "fixture";
        vm.serializeUint(obj, "chainId", chainId);
        vm.serializeAddress(obj, "address", sig.implementation);
        vm.serializeUint(obj, "nonce", sig.nonce);
        vm.serializeBytes32(obj, "r", sig.r);
        vm.serializeBytes32(obj, "s", sig.s);
        string memory json = vm.serializeUint(obj, "v", sig.v);
        vm.writeJson(json, string.concat("generated/", caseName, ".json"));
    }
}
