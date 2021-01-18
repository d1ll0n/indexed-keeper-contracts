const { expect } = require("chai");
const { BigNumber } = require("ethers");

const { getSignersWithAddresses, expandTo18Decimals, fastForward } = require('./utils');

describe('KeeperVault.sol', () => {
  let token, vault;
  let owner, notOwner;

  const deploy = async (name, ...args) => (await ethers.getContractFactory(name)).deploy(...args);

  before(async () => {
    [owner, notOwner] = await getSignersWithAddresses()
    token = await deploy('MockERC20', 'Token', 'TKN');
    vault = await deploy('KeeperVault', token.address);
  })

  describe('Constructor', () => {
    it('rewardsToken', async () => {
      expect(await vault.rewardsToken()).to.eq(token.address)
    })

    it('rewardsPerGas', async () => {
      expect(await vault.rewardsPerGas()).to.eq(0)
    })

    it('maxDailyRewards', async () => {
      expect(await vault.maxDailyRewards()).to.eq(0)
    })

    it('rewardsToday', async () => {
      expect(await vault.rewardsToday()).to.eq(0)
    })

    it('lastUpdate', async () => {
      expect(await vault.lastUpdate()).to.eq(00)
    })
  })

  describe('Configuration', () => {
    it('setMaxDailyRewards', async () => {
      await vault.setMaxDailyRewards(expandTo18Decimals(100))
      expect(await vault.maxDailyRewards()).to.eq(expandTo18Decimals(100))
    })

    it('setRewardsPerGas', async () => {
      await vault.setRewardsPerGas(100)
      expect(await vault.rewardsPerGas()).to.eq(100)
    })

    it('approveKeeper', async () => {
      await vault.approveKeeper(notOwner.address)
      expect(await vault.isApprovedKeeper(notOwner.address)).to.be.true
    })

    it('disapproveKeeper', async () => {
      await vault.disapproveKeeper(notOwner.address)
      expect(await vault.isApprovedKeeper(notOwner.address)).to.be.false
    })
  })

  describe('Access Control', () => {
    it('setMaxDailyRewards', async () => {
      await expect(
        vault.connect(notOwner).setMaxDailyRewards(expandTo18Decimals(100))
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('setRewardsPerGas', async () => {
      await expect(
        vault.connect(notOwner).setRewardsPerGas(100)
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('approveKeeper', async () => {
      await expect(
        vault.connect(notOwner).approveKeeper(notOwner.address)
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('disapproveKeeper', async () => {
      await expect(
        vault.connect(notOwner).disapproveKeeper(notOwner.address)
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('withdraw', async () => {
      await expect(
        vault.connect(notOwner).withdraw(0)
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('collectRewardsForGas', async () => {
      await expect(
        vault.collectRewardsForGas(owner.address, 0)
      ).to.be.revertedWith('Caller not an approved keeper contract')
    })
  })

  describe('withdraw', async () => {
    it('transfers to owner', async () => {
      await token.getFreeTokens(vault.address, 100)
      await vault.withdraw(100)
      expect(await token.balanceOf(owner.address)).to.eq(100)
    })

    it('reverts on failed transfer', async () => {
      await expect(vault.withdraw(100)).to.be.revertedWith('ERC20: transfer amount exceeds balance')
    })
  })

  describe('collectRewardsForGas', () => {
    let timestamp
    before(async () => {
      await vault.setRewardsPerGas(1)
      await vault.setMaxDailyRewards(100)
      await token.getFreeTokens(vault.address, 200)
      await vault.approveKeeper(owner.address)
    })

    it('fails if vault can not afford payment', async () => {
      await expect(
        vault.collectRewardsForGas(notOwner.address, 201)
      ).to.be.reverted
    })

    describe('state changes', () => {
      it('pays recipient gas * rewardPerGas', async () => {
        const timeUntilNextDay = 86400 - ((await ethers.provider.getBlock('latest')).timestamp % 86400)
        await fastForward(timeUntilNextDay)
        const tx = await vault.collectRewardsForGas(notOwner.address, 20);
        ({ timestamp } = await ethers.provider.getBlock((await tx.wait()).blockNumber));
        expect(await token.balanceOf(notOwner.address)).to.eq(20)
      })
  
      it('sets lastUpdate', async () => {
        expect(await vault.lastUpdate()).to.eq(timestamp)
      })
  
      it('sets rewardsToday', async () => {
        expect(await vault.rewardsToday()).to.eq(20)
      })
    })

    describe('daily rewards', () => {
      it('increments rewardsToday on same day', async () => {
        const tx = await vault.collectRewardsForGas(notOwner.address, 20);
        ({ timestamp } = await ethers.provider.getBlock((await tx.wait()).blockNumber));
        expect(await token.balanceOf(notOwner.address)).to.eq(40)
        expect(await vault.lastUpdate()).to.eq(timestamp)
        expect(await vault.rewardsToday()).to.eq(40)
      })

      it('fails if payment exceeds maxDailyRewards', async () => {
        await expect(
          vault.collectRewardsForGas(notOwner.address, 61)
        ).to.be.revertedWith('Exceeds maximum daily rewards')
      })

      it('resets rewardsToday on new day', async () => {
        const timeUntilNextDay = 86400 - (timestamp % 86400)
        await fastForward(timeUntilNextDay)
        const tx = await vault.collectRewardsForGas(notOwner.address, 20);
        ({ timestamp } = await ethers.provider.getBlock((await tx.wait()).blockNumber))
        expect(await token.balanceOf(notOwner.address)).to.eq(60)
        expect(await vault.lastUpdate()).to.eq(timestamp)
        expect(await vault.rewardsToday()).to.eq(20)
      })
    })
  })
})