// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

/* ========== External Inheritance ========== */
import "@openzeppelin/contracts/access/Ownable.sol";

/* ========== External Libraries ========== */
import "@openzeppelin/contracts/math/SafeMath.sol";

/* ========== External Interfaces ========== */
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";


contract KeeperVault is Ownable {
  using SafeMath for uint;
  using SafeERC20 for IERC20;

  event PaidKeeperRewards(address recipient, uint256 gasUsed, uint256 reward);

/* ==========  Immutables  ========== */

  /** @dev Address of the token paid for keeper rewards. */
  address public immutable rewardsToken;

/* ==========  Storage  ========== */

  /** @dev Amount of `rewardsToken` paid per unit of gas spent in a keeper call. */
  uint256 public rewardsPerGas;

  /** @dev Maximum amount of `rewardsToken` that can be paid per day. */
  uint256 public maxDailyRewards;

  /** @dev Amount paid in rewards for the current day - reset whenever `lastUpdate` is from a different day. */
  uint256 public rewardsToday;

  /** @dev Timestamp of last payment. */
  uint256 public lastUpdate;

  mapping(address => bool) public isApprovedKeeper;

/* ==========  Constructor  ========== */

  constructor(address rewardsToken_) public Ownable() {
    rewardsToken = rewardsToken_;
  }

/* ==========  Utils  ========== */

  /**
   * @dev Converts unix timestamp to days.
   */
  function day(uint256 timestamp) internal pure returns (uint256) {
    return timestamp / (1 days);
  }

/* ==========  Rewards  ========== */

  /**
   * @dev Collects rewards for a user who executed a keeper function.
   * Provides `rewardsPerGas` per unit of gas spent.
   *
   * Note: Must be called by an approved keeper contract.
   * Note: The total reward paid can not bring the current day's rewards
   * above `maxDailyRewards`
   */
  function collectRewardsForGas(address recipient, uint256 gasUsed) external {
    require(isApprovedKeeper[msg.sender], "KeeperVault::collectRewardsForGas: Caller not an approved keeper contract");

    uint256 reward = gasUsed.mul(rewardsPerGas);
    uint256 newRewardsToday = rewardsToday;

    if (day(now) != day(lastUpdate)) {
      newRewardsToday = reward;
    } else {
      newRewardsToday = newRewardsToday.add(reward);
    }
    require(newRewardsToday <= maxDailyRewards, "KeeperVault::collectRewardsForGas: Exceeds maximum daily rewards");
    lastUpdate = now;
    rewardsToday = newRewardsToday;
    IERC20(rewardsToken).safeTransfer(recipient, reward);
    emit PaidKeeperRewards(recipient, gasUsed, reward);
  }

/* ==========  Controls & Configuration  ========== */

  /**
   * @dev Withdraw `amount` of the rewards token to the owner.
   */
  function withdraw(uint256 amount) external onlyOwner {
    IERC20(rewardsToken).safeTransfer(owner(), amount);
  }

  /**
   * @dev Set the maximum amount of the rewards token that can be distributed per day.
   */
  function setMaxDailyRewards(uint256 maxDailyRewards_) external onlyOwner {
    maxDailyRewards = maxDailyRewards_;
  }

  /**
   * @dev Set the amount of the rewards token that will be paid per unit of gas
   * used in a keeper function.
   */
  function setRewardsPerGas(uint256 rewardPerGas_) external onlyOwner {
    rewardsPerGas = rewardPerGas_;
  }

  /**
   * @dev Add `keeper` as an approved keeper contract.
   * This will enable it to request rewards for users who execute keeper tasks.
   */
  function approveKeeper(address keeper) external onlyOwner {
    isApprovedKeeper[keeper] = true;
  }

  /**
   * @dev Remove `keeper` as an approved keeper contract.
   * This will disable it from requesting rewards for users who execute keeper tasks.
   */
  function disapproveKeeper(address keeper) external onlyOwner {
    isApprovedKeeper[keeper] = false;
  }
}