// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.24;

/// @notice A minimal EIP-1967 proxy used as an EIP-7702 delegate fixture —
/// the "delegate is itself a proxy" case (PL-7702-007, Phase 2). Storage
/// lives at the standard EIP-1967 implementation slot so real proxy
/// detection logic can be exercised against it.
contract ProxyDelegate {
    // bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1)
    bytes32 internal constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    constructor(address implementation_) {
        require(implementation_.code.length > 0, "implementation must be a contract");
        assembly {
            sstore(IMPLEMENTATION_SLOT, implementation_)
        }
    }

    function _implementation() internal view returns (address impl) {
        assembly {
            impl := sload(IMPLEMENTATION_SLOT)
        }
    }

    fallback() external payable {
        address impl = _implementation();
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {}
}
