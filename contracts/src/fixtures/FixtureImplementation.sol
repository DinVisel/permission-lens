// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.24;

/// @notice Trivial implementation contract for ProxyDelegate.sol — exists
/// only so the proxy fixture has somewhere real to delegatecall to.
contract FixtureImplementation {
    function version() external pure returns (string memory) {
        return "fixture-1";
    }
}
