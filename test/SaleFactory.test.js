const { assert, expect } = require("chai")
const { ether } = require("@openzeppelin/test-helpers")
const BigNumber = require("bignumber.js")

const TokenProxy = artifacts.require("TokenProxy")
const XStarterToken = artifacts.require("XStarterToken")
const XStarterStaking = artifacts.require("XStarterStaking")
const SaleFactory = artifacts.require("SaleFactory")
const Sale = artifacts.require("Sale")
const CaseToken_V2 = artifacts.require("CaseToken_V2")
const { web3 } = require("@openzeppelin/test-helpers/src/setup")
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers');

contract("Test SaleFactory and Sale contracts", function (accounts) {
  const [admin, proxyAdmin, alice, john, jack, bob, sam, kyle, dale, homer, harry, james, george, edward, ryan, eric, tom, ben, jen, ken, ...rest] = accounts
  const randomTokenName = "Token"
  const randomTokenDecimals = 8
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
    this.xStarterStaking = await XStarterStaking.new(this.proxyInstance.address, admin, [0, 100, 500, 1000, 2500, 5000, 7500, 10000, 20000].map(value => value + "0".repeat(8)));
    const minter_role = await this.tokenInstance.MINTER_ROLE()
    await this.tokenInstance.grantRole(minter_role, this.xStarterStaking.address, {
      from: admin,
    })

    // Sale Factory
    this.saleFactory = await SaleFactory.new(admin, this.xStarterStaking.address);

    // Any ERC20 Token
    this.randomToken = await CaseToken_V2.new({ from: admin })
    await this.randomToken.changeTokenData(randomTokenName, "TKN", randomTokenDecimals)
    await this.randomToken.initialize(admin);
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
              return reject(err);
            }
            const newBlockHash = web3.eth.getBlock("latest").hash;
    
            return resolve(newBlockHash);
          },
        );
      });
    };
    this.bnToString = function (bn) {
      return BigNumber(bn).toFixed(0)
    }

    this.epsilon = () => 1e-3

    this.epsilon_equal = function (curr, prev) {
      return BigNumber(curr).eq(prev) || BigNumber(curr).minus(prev).div(prev).abs().lt(this.epsilon())
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



    this.addDecimals = (amount, decimals) => amount == "0" ? "0" : amount + "0".repeat(decimals)

    this.CASE_PRECISION = 10 ** 8
    this.CASE_10 = 1e1 * this.CASE_PRECISION
    this.CASE_100 = 1e2 * this.CASE_PRECISION
    this.CASE_1000 = 1e3 * this.CASE_PRECISION
    this.CASE_10000 = 1e4 * this.CASE_PRECISION
    this.ZERO_ADDR = "0x0000000000000000000000000000000000000000"
    this.SECONDS_IN_DAY = 86400
  })
  describe("Test Creating New Sale", async () => {
    it("Case staking setup", async () => {
      // mint tokens to alice for staking
      await this.setupTokensForStaking(alice, this.CASE_10000)
      const initBalanceAlice = await this.tokenInstance.balanceOf(alice)
      assert.deepEqual(initBalanceAlice.toString(), "1000000000000")

      //staking
      const stakeForDays = 100
      await this.xStarterStaking.stake(
        this.CASE_10000,
        { from: alice }
      )
      // check alise's tier
      const aliceTierLevelStaked = await this.xStarterStaking.userTiers(alice);
      assert.deepEqual(aliceTierLevelStaked.toString(), "7")
      
    })
    it("Admin can be changed, only admin can give permissions to create new sales.", async () => {
      // Check if admin is set in constructor
      let currentAdmin = await this.saleFactory.admin()
      assert.deepEqual(currentAdmin, admin)
      // Alice can't give permission to create sales
      await expectRevert.unspecified(this.saleFactory.setSaleCreator(alice, true, {from: alice}))
      // Alice can't change admin
      await expectRevert.unspecified(this.saleFactory.changeAdmin(alice, {from: alice}))
      // Admin can change admin
      await this.saleFactory.changeAdmin(alice, {from: admin})
      // Admin can give permission to create sales
      await this.saleFactory.setSaleCreator(alice, true, {from: alice})
      currentAdmin = await this.saleFactory.admin()
      assert.deepEqual(currentAdmin, alice)
    })
    it("Creates sale and emits a saleCreated event", async () => {
      const blockNumber = await web3.eth.getBlockNumber()
      const block = await web3.eth.getBlock(blockNumber)
      this.currentTimestamp = block.timestamp
      this.tommorow = this.currentTimestamp  + this.SECONDS_IN_DAY
      this.dayAfterTommorow = this.currentTimestamp + 2 * this.SECONDS_IN_DAY
      // Can't create sale without permission
      await expectRevert.unspecified(this.saleFactory.createNewSale(
        randomTokenName,
        this.randomToken.address,
        admin,
        this.addDecimals(1000, randomTokenDecimals),
        [0, 10, 100, 1000, 1500, 2000, 3000, 10000, 20000].map(value => this.addDecimals(value, randomTokenDecimals)),
        this.tommorow,
        this.dayAfterTommorow,
        web3.utils.toWei("2"),
        'description',
        { from: admin }
      ))
      await this.saleFactory.setSaleCreator(admin, true, {from: alice})
      const saleCreatedReceipt = await this.saleFactory.createNewSale(
        randomTokenName,
        this.randomToken.address,
        admin,
        this.addDecimals(1000, randomTokenDecimals),
        [0, 10, 100, 1000, 1500, 2000, 3000, 10000, 20000].map(value => this.addDecimals(value, randomTokenDecimals)),
        this.tommorow,
        this.dayAfterTommorow,
        web3.utils.toWei("2"),
        'description',
        { from: admin }
      );
      expectEvent(saleCreatedReceipt, 'saleCreated');
      this.sale = await Sale.at(saleCreatedReceipt.logs[0].args.saleAddress);

    })
    it("Can add tokens for sale", async () => {
      //Mint and approve 100,000 TKN
      await this.randomToken.mint(admin, "10000000000000");
      await this.randomToken.approve(
				this.sale.address,
				"10000000000000",
				{ from: admin }
			);
      // Can't add tokens if sale isn't approved
      await expectRevert.unspecified(this.sale.addTokensForSale("10000000000000"))

      await this.sale.approve({from:admin})
      await this.sale.addTokensForSale("10000000000000")
      const hardcap = await this.sale.hardcap()
      assert.deepEqual(hardcap.toString(), "10000000000000")
    })
    it("Check the initial values of the sale", async () => {
      const approved = await this.sale.approved();
      const isSaleActive = await this.sale.isSaleActive()
      const hasSaleEnded = await this.sale.hasSaleEnded()
      const tokenName = await this.sale.tokenName()
      const tokenAddress = await this.sale.tokenAddress()
      const softcap = await this.sale.softcap()
      const startTimestamp = await this.sale.startTimestamp()
      const endTimestamp = await this.sale.endTimestamp()
      const price = await this.sale.price()
      const description = await this.sale.description()
      const totalTokensSold = await this.sale.totalTokensSold()
      const aliceTokenBalance = await this.sale.tokenBalances(alice)

      assert.deepEqual(approved, true)
      assert.deepEqual(isSaleActive, false)
      assert.deepEqual(hasSaleEnded, false)
      assert.deepEqual(tokenName, randomTokenName)
      assert.deepEqual(tokenAddress, this.randomToken.address)
      assert.deepEqual(softcap.toString(), this.addDecimals(1000, randomTokenDecimals))
      assert.deepEqual(startTimestamp.toString(), this.tommorow.toString())
      assert.deepEqual(endTimestamp.toString(), this.dayAfterTommorow.toString())
      assert.deepEqual(price.toString(), web3.utils.toWei('2'))
      assert.deepEqual(description, 'description')
      assert.deepEqual(totalTokensSold.toString(), '0')
      assert.deepEqual(aliceTokenBalance.toString(), '0')
    })
    it("Can change price if sale hasn't started yet", async () => {
      // 1 TKN = 0.00001 ETH
      const price = new web3.utils.BN(parseFloat('1') * Math.pow(10, 13));
      await this.sale.changePrice(price.toString(), {from: admin})
      const newPrice = await this.sale.price()
      assert.deepEqual(newPrice.toString(), price.toString())
    })
    it("Only admin can change price", async() => {
      await expectRevert(this.sale.changePrice(web3.utils.toWei('2'), {from: alice}), 'This function can be used only by admin.')
    })
    it("Admin can be changed, new admin can change price", async() => {
      // Alice can't change price
      await expectRevert.unspecified(this.sale.changePrice(web3.utils.toWei('2'), {from: alice}))
      // Alice can't change admin
      await expectRevert.unspecified(this.sale.changeAdmin(alice, {from:alice}))
      // Admin can change admin to alice
      await this.sale.changeAdmin(alice, {from: admin});
      // Alice can change price
      await this.sale.changePrice(web3.utils.toWei('2'), {from: alice});
      let newPrice = await this.sale.price()
      assert.deepEqual(newPrice.toString(), web3.utils.toWei('2').toString())
      // Admin can't change admin to admin
      await expectRevert.unspecified(this.sale.changeAdmin(admin, {from:admin}))
      // Alice changes admin to admin, admin can change price back
      await this.sale.changeAdmin(admin, {from:alice})
      const price = new web3.utils.BN(parseFloat('1') * Math.pow(10, 13));
      await this.sale.changePrice(price.toString(), {from: admin})
      newPrice = await this.sale.price()
      assert.deepEqual(newPrice.toString(), price.toString())
    })
    it("Can't buy tokens if sale hasn't started yet", async () => {
      await expectRevert(this.sale.buyTokens({ from: alice, value: web3.utils.toWei('1') }), 'This sale has already ended or not started.')
    })
    it("Can't withdraw funds if sale hasn't started yet", async () => {
      await expectRevert.unspecified(this.sale.withdrawFunds({from:alice}))
    })
    it("Can't withdraw tokens if sale hasn't started yet", async () => {
      await expectRevert.unspecified(this.sale.withdrawBoughtTokens({from:alice}))
    })
    it("Can buy tokens when sale started", async () => {
      await this.advanceBlockAtTime(this.tommorow + 10);
      //await this.timeTravel(this.SECONDS_IN_DAY + 60);
      const isSaleActive = await this.sale.isSaleActive();
      assert.deepEqual(isSaleActive, true);
      // 0.1 eth = 10,000 TKN
      await this.sale.buyTokens({from:alice, value:web3.utils.toWei('0.1')})
      const aliceTokenBalance = await this.sale.tokenBalances(alice);
      assert.deepEqual(aliceTokenBalance.toString(), "1000000000000");
      const aliceBalance = await this.sale.balances(alice);
      assert.deepEqual(aliceBalance.toString(), web3.utils.toWei('0.1').toString());
      const totalTokensSold = await this.sale.totalTokensSold();
      assert.deepEqual(totalTokensSold.toString(), "1000000000000");
      let participants = await this.sale.numberOfParticipants();
      assert.deepEqual(participants.toString(), "1")
    })
    it("Can't change price when sale started", async () => {
      await expectRevert(this.sale.changePrice(web3.utils.toWei('2'), {from: admin}), "Sale has already started.")
    })
    it("Can withdraw tokens after sale ended", async () => {
      await this.advanceBlockAtTime(this.dayAfterTommorow + 10);
      const isSaleActive = await this.sale.isSaleActive();
      assert.deepEqual(isSaleActive, false);
      const totalTokensSold = await this.sale.totalTokensSold();
      const softcap = await this.sale.softcap();
      await this.sale.withdrawBoughtTokens({from: alice});
      const randomTokenAliceBalance = await this.randomToken.balanceOf(alice);
      assert.deepEqual(randomTokenAliceBalance.toString(), "1000000000000");
      const aliceTokenBalance = await this.sale.tokenBalances(alice);
      assert.deepEqual(aliceTokenBalance.toString(), "0");
      const aliceBalance = await this.sale.balances(alice);
      assert.deepEqual(aliceBalance.toString(), "0");
    })
    it("Can't withdraw second time", async () => {
      await expectRevert(this.sale.withdrawBoughtTokens({from: alice}), "Insufficient funds.");
    })
    it("Saler can withdraw excess tokens and sale profit", async () => {
      const balanceBefore = await web3.eth.getBalance(admin);
      const withdrawReceipt = await this.sale.withdrawSaleResult({from:admin});
      const tokenBalance = await this.randomToken.balanceOf(admin);
      assert.deepEqual(tokenBalance.toString(), "9000000000000");
      const balanceAfter = await web3.eth.getBalance(admin);
      const gasPrice = await web3.eth.getGasPrice()
      let expectedBalance = new web3.utils.BN(balanceBefore)
      expectedBalance = expectedBalance.add(new web3.utils.BN(web3.utils.toWei('0.1')));
      expectedBalance = expectedBalance.sub(new web3.utils.BN(gasPrice * withdrawReceipt.receipt.gasUsed))
      assert.deepEqual(expectedBalance.toString(), balanceAfter.toString())
    })
  })
})