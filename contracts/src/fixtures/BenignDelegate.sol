// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.24;

/// @notice A "nothing sketchy here" EIP-7702 delegate fixture: a stateless
/// batch executor. It holds no admin state at all (so there's nothing to
/// front-run-initialize and no storage to collide with a prior delegate —
/// see LEARNING.md §5.5 and §10.3), and only ever acts on behalf of the
/// account it's delegated to (`msg.sender == address(this)`, true precisely
/// when this code is running as the EOA's own delegate).
contract BenignDelegate {
    event Executed(address indexed to, uint256 value, bytes data);

    error NotSelf();
    error CallFailed(bytes returndata);

    function execute(address to, uint256 value, bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(this)) revert NotSelf();
        (bool ok, bytes memory returndata) = to.call{value: value}(data);
        if (!ok) revert CallFailed(returndata);
        emit Executed(to, value, data);
        return returndata;
    }

    receive() external payable {}
}
