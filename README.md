# @indexed-finance/keeper-jobs

Keeper job contracts for Indexed Finance. Currently supports jobs for the MarketCapSqrtController contract.

The purpose of these contracts is to pay keepers who execute jobs required for basic maintenance such as oracle price updates. They are intended for use in conjunction with automated keeper bots which keep track of available jobs and execute them as needed.

## KeeperVault

KeeperVault stores the reward tokens which are paid to keepers. It stores a mapping of approved keeper job contracts which are allowed to collect rewards for keepers who execute jobs.

Rewards are paid based on gas used by the contract. KeeperVault stores a `rewardPerGas` value which determines the amount of the reward token to give to keepers for each unit of gas spent in a job transaction.

The vault keeps track of the total rewards paid to keepers each day, and can be configured to restrict this amount in order to give the owner time to find gas-burn errors and fix them without draining the pool.

**Access Control**

KeeperVault inherits the Ownable contract by OpenZeppelin to implement access control. The owner may approve and disapprove keeper job contracts to determine which contracts are allowed to request rewards from the vault.

## Keeper Jobs

Job contracts define the conditions for when rewards may be paid to keepers. Job contracts must inherit the `JobsBase` contract, which defines a `rewardForGasUsed` modifier that all job functions must use. This modifier calculates the gas used in the job function and then calls the vault to reward the caller. In order to prevent the vault from being drained, jobs should avoid calling any unknown or unpredictable contracts that may be maliciously implemented to burn large amounts of gas.

All keeper functions must use both `rewardForGasUsed` and `nonReentrant` to ensure the contracts reward keepers for gas used and can not be re-entered during the call.

## MarketCapSqrtControllerJobs

MarketCapSqrtControllerJobs defines the keeper jobs for the MarketCapSqrtController contract which controls the index pools for Indexed. This defines 4 keeper jobs:

### `orderCategoryTokensByMarketCap`

Calls the pool controller to sort a category's tokens in descending order by market cap.

The pool controller only needs the category to be sorted prior to deploying a new index pool or when a pool is ready to be re-indexed. No minimum delay is enforced on the controller, so the job contract defines a 3.5 day minimum delay.

### `updateCategoryPrices`

Calls the pool controller to update the prices in the oracle for all the tokens in a particular category.

The uniswap oracle contract allows this to be called once an hour, but the pool controller only needs the prices updated on a weekly basis in order to handle re-indexing and re-weighing. A 3.5 day minimum delay is enforced on the keeper contract to ensure that prices are never more than half a week old. This is also useful for pools in the same category that are out of sync in their re-indexing.

### `reweighPool`

Calls the pool controller to reweigh an index pool. Has no additional restrictions, as this function will revert in the controller if not needed.

### `reindexPool`

Calls the pool controller to reindex an index pool. Has no additional restrictions, as this function will revert in the controller if not needed.