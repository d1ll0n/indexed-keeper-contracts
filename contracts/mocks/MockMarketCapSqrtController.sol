// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;


interface IMarketCapSqrtControllerJobs {
  function orderCategoryTokensByMarketCap(uint256 categoryID) external;
  function updateCategoryPrices(uint256 categoryID) external;
  function reweighPool(address poolAddress) external;
  function reindexPool(address poolAddress) external;
}


contract MockMarketCapSqrtController {
  mapping(uint256 => uint256) public lastSort;
  mapping(uint256 => uint256) public lastPriceUpdate;
  mapping(address => uint256) public lastReweigh;
  mapping(address => uint256) public lastReindex;
  bool doReentry;

  function setDoReentry(bool doReentry_) external {
    doReentry = doReentry_;
  }

  function reweighPool(address poolAddress) external {
    if (doReentry) {
      IMarketCapSqrtControllerJobs(msg.sender).reweighPool(poolAddress);
    }
    lastReweigh[poolAddress] = now;
  }

  function reindexPool(address poolAddress) external {
    if (doReentry) {
      IMarketCapSqrtControllerJobs(msg.sender).reindexPool(poolAddress);
    }
    lastReindex[poolAddress] = now;
  }

  function orderCategoryTokensByMarketCap(uint256 categoryID) external {
    if (doReentry) {
      IMarketCapSqrtControllerJobs(msg.sender).orderCategoryTokensByMarketCap(categoryID);
    }
    lastSort[categoryID] = now;
  }

  function updateCategoryPrices(uint256 categoryID) external returns (bool[] memory pricesUpdated) {
    if (doReentry) {
      IMarketCapSqrtControllerJobs(msg.sender).updateCategoryPrices(categoryID);
    }
    lastPriceUpdate[categoryID] = now;
  }

  function getLastCategoryUpdate(uint256 categoryID) external view returns (uint256) {
    return lastSort[categoryID];
  }
}