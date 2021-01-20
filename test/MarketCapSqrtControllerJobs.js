const { expect } = require("chai");
const { BigNumber } = require("ethers");

const { getSignersWithAddresses, expandTo18Decimals, fastForward, zeroAddress } = require('./utils');

describe('MarketCapSqrtControllerJobs.sol', () => {
  let token, vault, jobs, controller;
  let owner, notOwner;

  const deploy = async (name, ...args) => (await ethers.getContractFactory(name)).deploy(...args);

  function setupTests() {
    before(async () => {
      [owner, notOwner] = await getSignersWithAddresses()
      token = await deploy('MockERC20', 'Token', 'TKN');
      vault = await deploy('KeeperVault', token.address);
      controller = await deploy('MockMarketCapSqrtController')
      jobs = await deploy('MarketCapSqrtControllerJobs', controller.address, vault.address)
      await vault.setRewardsPerGas(1)
      await vault.setMaxDailyRewards(100000)
      await token.getFreeTokens(vault.address, 1000000)
      await vault.approveKeeper(jobs.address)
    })
  }

  describe('Constructor', () => {
    setupTests();
    
    it('MIN_SORT_DELAY', async () => {
      expect(await jobs.MIN_SORT_DELAY()).to.eq(86400 * 3.5)
    })

    it('MIN_PRICE_UPDATE_DELAY', async () => {
      expect(await jobs.MIN_PRICE_UPDATE_DELAY()).to.eq(86400 * 1)
    })

    it('controller', async () => {
      expect(await jobs.controller()).to.eq(controller.address)
    })

    it('vault', async () => {
      expect(await jobs.vault()).to.eq(vault.address)
    })
  })

  describe('updateCategoryPrices', () => {
    let timestamp

    setupTests();

    it('pays at least the gas used for the base function', async () => {
      const { gasUsed: baseGas } = await controller.updateCategoryPrices(1).then(tx => tx.wait())
      const tx = await jobs.updateCategoryPrices(1);
      ({ timestamp } = await ethers.provider.getBlock((await tx.wait()).blockNumber));
      expect(await token.balanceOf(owner.address)).to.be.gte(baseGas.sub(21000))
    })

    it('calls base fn', async () => {
      expect(await controller.lastPriceUpdate(1)).to.eq(timestamp)
    })

    it('updates lastCategoryPriceUpdate', async () => {
      expect(await jobs.lastCategoryPriceUpdate(1)).to.eq(timestamp)
    })

    it('reverts if less than 3.5 days have passed', async () => {
      await expect(
        jobs.updateCategoryPrices(1)
      ).to.be.revertedWith('MarketCapSqrtControllerJobs::updateCategoryPrices: Update not ready')
    })

    it('protects against reentry', async () => {
      await fastForward(86400 * 4)
      await controller.setDoReentry(true)
      await expect(
        jobs.updateCategoryPrices(1)
      ).to.be.revertedWith('ReentrancyGuard: reentrant call')
    })
  })

  describe('reweighPool', () => {
    let timestamp

    setupTests();

    it('pays at least the gas used for the base function', async () => {
      const { gasUsed: baseGas } = await controller.reweighPool(notOwner.address).then(tx => tx.wait())
      const tx = await jobs.reweighPool(notOwner.address);
      ({ timestamp } = await ethers.provider.getBlock((await tx.wait()).blockNumber));
      expect(await token.balanceOf(owner.address)).to.be.gte(baseGas.sub(21000))
    })

    it('calls base fn', async () => {
      expect(await controller.lastReweigh(notOwner.address)).to.eq(timestamp)
    })

    it('protects against reentry', async () => {
      await fastForward(86400 * 4)
      await controller.setDoReentry(true)
      await expect(
        jobs.reweighPool(notOwner.address)
      ).to.be.revertedWith('ReentrancyGuard: reentrant call')
    })
  })

  describe('reindexPool', () => {
    let timestamp, poolAddress

    before(async () => {
      poolAddress = await controller.computePoolAddress(1, 10);
    })

    describe('Category already sorted', async () => {

      setupTests();

      it('pays at least the gas used for the base function', async () => {
        await controller.orderCategoryTokensByMarketCap(1).then(tx => tx.wait())
        const { gasUsed: baseGas } = await controller.reindexPool(poolAddress).then(tx => tx.wait())
        const tx = await jobs.reindexPool(1, 10);
        ({ timestamp } = await ethers.provider.getBlock((await tx.wait()).blockNumber));
        expect(await token.balanceOf(owner.address)).to.be.gte(baseGas.sub(21000))
      })
  
      it('calls base fn', async () => {
        expect(await controller.lastReindex(poolAddress)).to.eq(timestamp)
      })

      it('does not sort category', async () => {
        expect(await controller.getLastCategoryUpdate(1)).to.not.eq(timestamp)
      })
  
      it('protects against reentry', async () => {
        await fastForward(86400 * 4)
        await controller.setDoReentry(true)
        await expect(
          jobs.reindexPool(1, 10)
        ).to.be.revertedWith('ReentrancyGuard: reentrant call')
      })
    })

    describe('Category needs to be sorted', async () => {

      setupTests();

      it('pays at least the gas used for the base function', async () => {
        await fastForward(86400 * 4)
        const { gasUsed: baseGasIndex } = await controller.reindexPool(poolAddress).then(tx => tx.wait())
        const { gasUsed: baseGasSort } = await controller.orderCategoryTokensByMarketCap(1).then(tx => tx.wait())
        await fastForward(86400 * 4)
        const baseGas = baseGasIndex.add(baseGasSort);
        const tx = await jobs.reindexPool(1, 10);
        ({ timestamp } = await ethers.provider.getBlock((await tx.wait()).blockNumber));
        expect(await token.balanceOf(owner.address)).to.be.gte(baseGas.sub(21000))
      })
  
      it('calls base fn', async () => {
        expect(await controller.lastReindex(poolAddress)).to.eq(timestamp)
      })

      it('sorts category', async () => {
        expect(await controller.getLastCategoryUpdate(1)).to.eq(timestamp)
      })
  
      it('protects against reentry', async () => {
        await fastForward(86400 * 4)
        await controller.setDoReentry(true)
        await expect(
          jobs.reindexPool(1, 10)
        ).to.be.revertedWith('ReentrancyGuard: reentrant call')
      })
    })
  })
})