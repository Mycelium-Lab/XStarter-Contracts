const { assert } = require("chai")
const { ether } = require("@openzeppelin/test-helpers")
const BigNumber = require("bignumber.js")

const TokenProxy = artifacts.require("TokenProxy")
const XStarterToken = artifacts.require("XStarterToken")
const CaseStaking = artifacts.require("CaseStaking")

const { 
  insertLevelOrder, 
  getNodeHeight, 
  takeActionForCurrentLevelOrder, 
  takeActionForCurrentLevelOrderReverse 
} = require('../util/BinaryTree')

contract("Test Logic", function (accounts) {
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
    await tokenInstance.initialize(admin)

    // logic
    this.caseStaking = await CaseStaking.new(this.proxyInstance.address, admin, [0, 100, 500, 1000, 2500, 5000, 7500, 10000, 20000].map( value => value + "0".repeat(8)));
    await this.caseStaking.init()
    const minter_role = await this.tokenInstance.MINTER_ROLE()
    await this.tokenInstance.grantRole(minter_role, this.caseStaking.address, {
      from: admin,
    })

    // extras
    this.timeTravel = function (time) {
      return new Promise(function (resolve, reject) {
        return web3.currentProvider.send(
          {
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [time],
            id: new Date().getTime(),
          },
          function (err, result) {
            if (err) {
              return reject(err)
            }
            return resolve(result)
          }
        )
      })
    }

    this.bnToString = function(bn) {
      return BigNumber(bn).toFixed(0)
    }

    this.epsilon = () => 1e-3

    this.epsilon_equal = function(curr, prev) {
      return BigNumber(curr).eq(prev) || BigNumber(curr).minus(prev).div(prev).abs().lt(this.epsilon())
    }

    this.setupTokensForStaking = async (give_to, amount) => {
      await this.tokenInstance.mint(give_to, amount, {
        from: admin
      })

      await this.tokenInstance.approve(
        this.caseStaking.address,
        amount,
        { from: give_to }
      )
    }

    this.CASE_PRECISION = 10 ** 8
    this.CASE_10 = 1e1 * this.CASE_PRECISION
    this.CASE_100 = 1e2 * this.CASE_PRECISION
    this.CASE_1000 = 1e3 * this.CASE_PRECISION
    this.CASE_10000 = 1e4 * this.CASE_PRECISION
    this.ZERO_ADDR = "0x0000000000000000000000000000000000000000"
    this.SECONDS_IN_DAY = 86400
  })

  describe("Test Staking", () => {
    it("Check initially minted", async () => {
      // check 0 minted at the start
      const mintedStart = await this.caseStaking.mintedXStarterTokens()
      assert.deepEqual(mintedStart.toString(), "0")
    })

    it("Check interest amount", async () => {
      // interest amount
      const ia = await this.caseStaking.getInterestAmount(1000000000, 10)
      assert.deepEqual(ia.toString(), "15055027")

      const ia2 = await this.caseStaking.getInterestAmount(this.CASE_10000, 10)
      assert.deepEqual(ia2.toString(), "15082397260")
    })

    it("Check token matches proxy", async () => {
      // test token
      const token = await this.caseStaking.xstarterToken()
      assert.deepEqual(token, this.proxyInstance.address)
    })

    it("Check staking", async () => {
      // prepare for staking
      const supplyBefore = await this.tokenInstance.totalSupply()

      // mint tokens to alice for staking
      await this.setupTokensForStaking(alice, this.CASE_10000)

      const initBalanceAlice = await this.tokenInstance.balanceOf(alice)
      assert.deepEqual(initBalanceAlice.toString(), "1000000000000")

      // actual staking
      const stakeForDays = 100
      await this.caseStaking.stake(
        this.CASE_10000,
        stakeForDays,
        { from: alice }
      )
      const supplyAfter = await this.tokenInstance.totalSupply()
      assert.deepEqual(supplyBefore.toString(), "0")
      assert.deepEqual(supplyAfter.toString(), "1155323972602")
      const aliceTierLevelStaked = await this.caseStaking.userTiers(alice);
      assert.deepEqual(aliceTierLevelStaked.toString(), "7")
      const minted = await this.caseStaking.mintedXStarterTokens()
      assert.deepEqual(minted.toString(), "155323972602")
      
      await this.timeTravel(this.SECONDS_IN_DAY * stakeForDays)
      await this.caseStaking.withdraw(0, { from: alice })
      const balanceAliceAfterWithdrawal = await this.tokenInstance.balanceOf(
        alice
      )
      assert.deepEqual(balanceAliceAfterWithdrawal.toString(), "1155323972602")
      const aliceTierLevelWithdrawn = await this.caseStaking.userTiers(alice);
      assert.deepEqual(aliceTierLevelWithdrawn.toString(), "0");
      // MANUALLY
      // const manualWithdrawAfter = () =>
      //   new Promise((resolve) => {
      //     setTimeout(async () => {
      //       await this.caseStaking.withdraw(0, { from: alice })
      //       const balanceAliceAfterWithdrawal =
      //         await this.tokenInstance.balanceOf(alice)
      //       console.log(balanceAliceAfterWithdrawal.toString())
      //       resolve()
      //     }, 10 * 1000)
      //   })
      // await manualWithdrawAfter()
    })
  })
})