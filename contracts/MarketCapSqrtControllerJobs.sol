// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;


/* ========== Internal Inheritance ========== */
import "./JobsBase.sol";


contract MarketCapSqrtControllerJobs is JobsBase {
/* ==========  Constants  ========== */

  /** @dev Minimum delay between category sorting calls. */
  uint256 public constant MIN_SORT_DELAY = 3.5 days;

  /** @dev Minimum delay between category price update calls. */
  uint256 public constant MIN_PRICE_UPDATE_DELAY = 1 days;

  /** @dev Tokens which the contract will reward keepers for updating the price of. */
  mapping(address => bool) public oracleWhitelist;

/* ==========  Immutables  ========== */

  /** @dev Address of MarketCapSqrtController */
  address public immutable controller;

/* ==========  Storage  ========== */

  /** @dev Last time that a category's tokens had a price update through the keeper. */
  mapping(uint256 => uint256) public lastCategoryPriceUpdate;

/* ==========  Constructor  ========== */

  constructor(address controller_, address vault_) public JobsBase(vault_) {
    controller = controller_;
  }

/* ==========  Jobs  ========== */

  /**
   * @dev Update the prices of the tokens in `categoryID`.
   *
   * Rewards the caller with `priceUpdateRewardPerToken` for each token in
   * the category.
   *
   * Note: Must not have been called for the same category in the last
   * `MIN_PRICE_UPDATE_DELAY` seconds.
   */
  function updateCategoryPrices(uint256 categoryID) external rewardForGasUsed nonReentrant {
    uint256 lastUpdate = lastCategoryPriceUpdate[categoryID];
    require(
      now - lastUpdate >= MIN_PRICE_UPDATE_DELAY,
      "MarketCapSqrtControllerJobs::updateCategoryPrices: Update not ready"
    );
    lastCategoryPriceUpdate[categoryID] = now;
    IMarketCapSqrtController(controller).updateCategoryPrices(categoryID);
  }

  /**
   * @dev Update the target weights for an index pool.
   *
   * Note: The pool must be ready to be reweighed.
   */
  function reweighPool(address poolAddress) external rewardForGasUsed nonReentrant {
    IMarketCapSqrtController(controller).reweighPool(poolAddress);
  }

  /**
   * @dev Update the target weights and assets for an index pool.
   *
   * The category ID and index size are provided instead of the pool address in
   * order to check if the category must be sorted prior to executing the reindex call.
   */
  function reindexPool(uint256 categoryID, uint256 indexSize) external rewardForGasUsed nonReentrant {
    address poolAddress = IMarketCapSqrtController(controller).computePoolAddress(categoryID, indexSize);
    uint256 lastUpdate = IMarketCapSqrtController(controller).getLastCategoryUpdate(categoryID);
    if(now - lastUpdate >= 1 days) {
      IMarketCapSqrtController(controller).orderCategoryTokensByMarketCap(categoryID);
    }
    IMarketCapSqrtController(controller).reindexPool(poolAddress);
  }
}


interface IMarketCapSqrtController {
  function updateCategoryPrices(uint256 categoryID) external returns (bool[] memory pricesUpdated);
  function orderCategoryTokensByMarketCap(uint256 categoryID) external;
  function reweighPool(address poolAddress) external;
  function reindexPool(address poolAddress) external;
  function getLastCategoryUpdate(uint256 categoryID) external view returns (uint256);
  function computePoolAddress(uint256 categoryID, uint256 indexSize) external view returns (address poolAddress);
}