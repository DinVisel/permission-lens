// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BenignDelegate} from "../src/fixtures/BenignDelegate.sol";
import {SweeperDelegate} from "../src/fixtures/SweeperDelegate.sol";
import {ProxyDelegate} from "../src/fixtures/ProxyDelegate.sol";
import {FixtureImplementation} from "../src/fixtures/FixtureImplementation.sol";

// Sanity tests for the fixture contracts themselves — not for the
// permissionlens core package (that's packages/core/test/golden.test.ts,
// which reads what GenerateFixtures.s.sol + scripts/build-fixtures.mjs produce).
contract FixturesTest is Test {
    uint256 constant AUTHORITY_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    function test_benignDelegate_onlyExecutesForSelf() public {
        address authority = vm.addr(AUTHORITY_PK);
        BenignDelegate benign = new BenignDelegate();
        vm.signAndAttachDelegation(address(benign), AUTHORITY_PK);

        vm.expectRevert(BenignDelegate.NotSelf.selector);
        BenignDelegate(payable(authority)).execute(address(0xBEEF), 0, "");
    }

    function test_sweeperDelegate_forwardsBalanceToCollector() public {
        address authority = vm.addr(AUTHORITY_PK);
        SweeperDelegate sweeper = new SweeperDelegate();
        vm.signAndAttachDelegation(address(sweeper), AUTHORITY_PK);

        vm.deal(authority, 1 ether);
        vm.prank(address(0xCAFE));
        (bool ok,) = authority.call{value: 0}("");
        assertTrue(ok);

        assertEq(sweeper.COLLECTOR().balance, 1 ether);
        assertEq(authority.balance, 0);
    }

    function test_proxyDelegate_delegatesToImplementation() public {
        FixtureImplementation impl = new FixtureImplementation();
        ProxyDelegate proxy = new ProxyDelegate(address(impl));

        (bool ok, bytes memory data) = address(proxy).call(abi.encodeWithSignature("version()"));
        assertTrue(ok);
        assertEq(abi.decode(data, (string)), "fixture-1");
    }
}
