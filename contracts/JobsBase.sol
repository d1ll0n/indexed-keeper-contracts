// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

/* ========== External Inheritance ========== */
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


contract JobsBase is ReentrancyGuard {
  address public immutable vault;

  constructor (address vault_) public {
    vault = vault_;
  }

  /**
   * @dev Modifier to reward the caller for the gas used by the primary
   * function in the keeper contract, plus 50,000 gas to cover costs associated
   * with the vault interaction.
   *
   * Note: This must be the first modifier in the set of function modifiers to
   * ensure the caller is paid for gas used by other modifiers.
   * Note: This must be used in conjunction with the nonReentrant modifier
   * from ReentrancyGuard.
   */
  modifier rewardForGasUsed {
    uint256 gasStart = gasleft();
    _;
    uint256 gasEnd = gasleft();
    IKeeperVault(vault).collectRewardsForGas(msg.sender, 50000 + gasStart - gasEnd);
  }
}


interface IKeeperVault {
  function collectRewardsForGas(address recipient, uint256 gasUsed) external;
}