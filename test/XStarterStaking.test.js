const { assert } = require("chai")
const BigNumber = require("bignumber.js")

const TokenProxy = artifacts.require("TokenProxy")
const XStarterToken = artifacts.require("XStarterToken")
const XStarterStaking = artifacts.require("XStarterStaking")
const { expectRevert } = require('@openzeppelin/test-helpers');
const { web3 } = require("@openzeppelin/test-helpers/src/setup")

contract("XStarterStaking", function (accounts) {
	const [admin, proxyAdmin, alice, john, jack, bob, sam, kyle, dale, homer, harry, james, george, edward, ryan, eric, tom, ben, jen, ken, ...rest] = accounts

	before(async () => {
		// token
		this.logicInstance = await XStarterToken.new({ from: admin })
		this.proxyInstance = await TokenProxy.new(
			this.logicInstance.address,
			proxyAdmin,
			"0x"
		)
		this.tokenInstance = await XStarterToken.at(this.proxyInstance.address)
		
		// logic
		this.xStarterStaking = await XStarterStaking.new(this.proxyInstance.address, admin, [0, 1000, 5000, 10000, 25000, 50000, 75000, 100000, 500000], 10)
		await this.tokenInstance.initialize(admin, "10000000000000", 10, this.xStarterStaking.address)

		this.advanceBlockAtTime = (time) => {
			return new Promise((resolve, reject) => {
				web3.currentProvider.send(
					{
						jsonrpc: "2.0",
						method: "evm_mine",
						params: [time],
						id: new Date().getTime(),
					},
					(err, _) => {
						if (err) {
							return reject(err)
						}
						const newBlockHash = web3.eth.getBlock("latest").hash

						return resolve(newBlockHash)
					},
				)
			})
		}

		this.setupTokensForStaking = async (give_to, amount) => {
			await this.tokenInstance.mint(give_to, amount, {
				from: admin
			})

			await this.tokenInstance.approve(
				this.xStarterStaking.address,
				amount,
				{ from: give_to }
			)
		}
		this.SECONDS_IN_DAY = 86400
	})
	this.calculateInterestAmountPerPeriod = async (stakeId, rate) => {
		let currentBlock = await web3.eth.getBlock('latest')
		let stake = await this.xStarterStaking.stakeList(stakeId)
		let currentTimestamp = new web3.utils.BN(currentBlock.timestamp + "")
		let secondsPassed = currentTimestamp.sub(stake.stakeTimestamp)

		const denumerator = new web3.utils.BN("3153600000")
		//const secondsBN = new web3.utils.BN(seconds)
		const rateBN = new web3.utils.BN(rate)
		let numerator = secondsPassed.mul(rateBN);
        numerator = numerator.mul(stake.stakeAmount);
        //const denumerator = SafeMath.mul(SECONDS_IN_ONE_YEAR, 100);
        return numerator.div(denumerator)
	}
	describe("Test Staking", () => {
		it("Check initially minted", async () => {
			const mintedStart = await this.xStarterStaking.mintedXStarterTokens()
			assert.deepEqual(mintedStart.toString(), "0")
		})

		it("Check token matches proxy", async () => {
			// test token
			const token = await this.xStarterStaking.xstarterToken()
			assert.deepEqual(token, this.proxyInstance.address)
		})

		it("Check stake created", async () => {
			// prepare for staking
			const supplyBefore = await this.tokenInstance.totalSupply()

			// transfer tokens to alice for staking
			await this.tokenInstance.approve(admin, "100000", {from: admin})
			await this.tokenInstance.transfer(alice, "100000", {from: admin})

			const initBalanceAlice = await this.tokenInstance.balanceOf(alice)
			assert.deepEqual(initBalanceAlice.toString(), "100000")
			// actual staking
			await this.tokenInstance.approve(this.xStarterStaking.address, "100000", {from: alice})
			await this.xStarterStaking.stake(
				"100000",
				{ from: alice }
			)
			const aliceStakeAmount = await this.xStarterStaking.userStakeAmount(alice)
			assert.deepEqual(aliceStakeAmount.toString(), "100000")
		})
		it("Check user tier after staking", async () => {
			const aliceTier = await this.xStarterStaking.userTiers(alice)
			assert.deepEqual(aliceTier.toString(), "7")
		})
		it("Check admin can update tiers and another user can't", async() => {
			await expectRevert(this.xStarterStaking.updateTierValues([0, 1000, 5000, 10000, 25000, 50000, 75000, 120000, 500000], {from: alice}), "This function can be used only by admin.")
			await this.xStarterStaking.updateTierValues([0, 1000, 5000, 10000, 25000, 50000, 75000, 120000, 500000], {from: admin})
			await expectRevert(this.xStarterStaking.updateSenderTier({from: admin}), "You didn't stake any coins. Your tier is 0.")
			await this.xStarterStaking.updateSenderTier({from: alice})
			let aliceTier = await this.xStarterStaking.userTiers(alice)
			assert.deepEqual(aliceTier.toString(), "6")
			await expectRevert(this.xStarterStaking.updateSpecificTierValue(100000, 7, {from: alice}), "This function can be used only by admin.")
			await expectRevert(this.xStarterStaking.updateSpecificTierValue(100000, 10, {from: admin}), "Wrong input values.")
			await expectRevert(this.xStarterStaking.updateSpecificTierValue(100000, 9, {from: admin}), "Wrong input values.")
			await this.xStarterStaking.updateSpecificTierValue(100000, 7, {from: admin})
			await this.xStarterStaking.updateSpecificTierValue(135000, 8, {from: admin})
			await this.xStarterStaking.updateSenderTier({from: alice})
			aliceTier = await this.xStarterStaking.userTiers(alice)
			assert.deepEqual(aliceTier.toString(), "7")
		})
		it("Check another user can't withdraw", async () => {
			await expectRevert.unspecified(this.xStarterStaking.withdraw(0, { from: admin }))
		})
		it("Can't get interest amount with wrong stake id", async () => {
			await expectRevert(this.xStarterStaking.calculateInterestAmount(123), 'XStarterStaking: Stake id is invalid')
		})
		it("Check interest amount values in different days", async () => {
			let blockNumber = await web3.eth.getBlockNumber()
			let block = await web3.eth.getBlock(blockNumber)
			const thirtyDays = block.timestamp + this.SECONDS_IN_DAY * 30
			await this.advanceBlockAtTime(thirtyDays)
			let interest = await this.xStarterStaking.calculateInterestAmount(0)
			let expectedInterest = await this.calculateInterestAmountPerPeriod(0, "10")
			assert.deepEqual(expectedInterest.toString(), interest.toString())
			const sixtyOneDay = block.timestamp + this.SECONDS_IN_DAY * 61
			await this.advanceBlockAtTime(sixtyOneDay)
			interest = await this.xStarterStaking.calculateInterestAmount(0)
			expectedInterest = await this.calculateInterestAmountPerPeriod(0, "10")
			assert.deepEqual(expectedInterest.toString(), interest.toString())
			const seventyFourDays = block.timestamp + this.SECONDS_IN_DAY * 74
			await this.advanceBlockAtTime(seventyFourDays)
			interest = await this.xStarterStaking.calculateInterestAmount(0)
			expectedInterest = await this.calculateInterestAmountPerPeriod(0, "10")
			assert.deepEqual(expectedInterest.toString(), interest.toString())
			const oneHundredEightyDays = block.timestamp + this.SECONDS_IN_DAY * 180
			await this.advanceBlockAtTime(oneHundredEightyDays)
			interest = await this.xStarterStaking.calculateInterestAmount(0)
			assert.deepEqual(interest.toString() === "4931" || interest.toString() ==="4930", true)
			//4931
			await this.xStarterStaking.changeAPR(20, {from:admin})
			const fiveHundredFortyFive = block.timestamp + this.SECONDS_IN_DAY * 545
			await this.advanceBlockAtTime(fiveHundredFortyFive)

			interest = await this.xStarterStaking.calculateInterestAmount(0)
			expectedInterest = await this.calculateInterestAmountPerPeriod(0, "10")
			assert.deepEqual(interest.toString() === "24930" || interest.toString() === "24931" , true)
			//20000
			await this.xStarterStaking.changeAPR(50, {from: admin})

			await this.tokenInstance.approve(admin, "100000", {from: admin})
			await this.tokenInstance.transfer(alice, "100000", {from: admin})
			await this.tokenInstance.approve(this.xStarterStaking.address, "100000", {from: alice})
			await this.xStarterStaking.stake(
				"100000",
				{ from: alice }
			)
			const sixHundredFortyFive = block.timestamp + this.SECONDS_IN_DAY * 645
			await this.advanceBlockAtTime(sixHundredFortyFive)
			interest = await this.xStarterStaking.calculateInterestAmount(0)
			let interestSecondStake = await this.xStarterStaking.calculateInterestAmount(1)
			assert.deepEqual(interestSecondStake.toString(), "13698")
			expectedInterest = await this.calculateInterestAmountPerPeriod(0, "10")
			assert.deepEqual(interest.toString() === "38628" || interest.toString() === "38629", true)
		})

		it("Only stake's owner can withdraw", async () => {
			await expectRevert(this.xStarterStaking.withdraw(0, { from: admin }), "XStarterStaking: Sender not staker")
		})
		it("Check withdraw", async () => {
			await this.xStarterStaking.withdraw(0, { from: alice })
			const afterStakingAliceBalance = await this.tokenInstance.balanceOf(alice)
			assert.deepEqual(afterStakingAliceBalance.toString() === "138629" || afterStakingAliceBalance.toString() === "138628", true)
			const mintedXStarterTokens = await this.xStarterStaking.mintedXStarterTokens()
			assert.deepEqual(mintedXStarterTokens.toString()==="38629" || mintedXStarterTokens.toString()==="38628", true)
			await this.xStarterStaking.withdraw(1, { from: alice })
			const userStakeAmount = await this.xStarterStaking.userStakeAmount(alice);
			assert.deepEqual(userStakeAmount.toString(),"0")
		})
		it("Check user tier after withdraw", async () => {
			const aliceTier = await this.xStarterStaking.userTiers(alice)
			assert.deepEqual(aliceTier.toString(), "0")
		})
		it("Check can't withdraw stake that already withdrawn", async () => {
			await expectRevert.unspecified(this.xStarterStaking.withdraw(0, { from: alice }))
		})
		it("Can't calculate interest when stake is not active", async () => {
			await expectRevert(this.xStarterStaking.calculateInterestAmount(0), 'XStarterStaking: Not active')
		})
		it("Check user tier with multiple stakes", async () => {
			await this.tokenInstance.approve(
				this.xStarterStaking.address,
				"13000",
				{ from: alice }
			)
			await this.xStarterStaking.stake(
				"5000",
				{ from: alice }
			)
			await this.xStarterStaking.stake(
				"7000",
				{ from: alice }
			)
			const aliceTier = await this.xStarterStaking.userTiers(alice);
			assert.deepEqual(aliceTier.toString(), "3")
		})

	})
})