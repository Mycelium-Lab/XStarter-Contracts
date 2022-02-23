const { assert, expect } = require("chai")
const { ether } = require("@openzeppelin/test-helpers")
const BigNumber = require("bignumber.js")

const TokenProxy = artifacts.require("TokenProxy")
const XStarterToken = artifacts.require("XStarterToken")
const XStarterStaking = artifacts.require("XStarterStaking")
const SaleFactory = artifacts.require("SaleFactory")
const Sale = artifacts.require("Sale")
const TestToken = artifacts.require("TestToken")
const { web3 } = require("@openzeppelin/test-helpers/src/setup")
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers');

contract("SaleFactory && Sale", function (accounts) {
  const [admin, proxyAdmin, alice, john, jack, bob, sam, kyle, dale, homer, harry, james, george, edward, ryan, eric, tom, ben, jen, ken, ...rest] = accounts
  const testTokenName = "Token"
  const testTokenDecimals = 8
  before(async () => {
    // token
    this.logicInstance = await XStarterToken.new({ from: admin })
    this.proxyInstance = await TokenProxy.new(
      this.logicInstance.address,
      proxyAdmin,
      "0x"
    )
    this.tokenInstance = await XStarterToken.at(this.proxyInstance.address)
    //await tokenInstance.initialize(admin)

    // logic
    this.xStarterStaking = await XStarterStaking.new(this.proxyInstance.address, admin, [0, 100, 500, 1000, 2500, 5000, 7500, 10000, 20000].map(value => value + "0".repeat(8)), 10);
    await this.tokenInstance.initialize(admin, "10000000000000", 10, this.xStarterStaking.address)
    // Sale Factory
    this.saleFactory = await SaleFactory.new(admin, this.xStarterStaking.address);

    // Any ERC20 Token
    this.testToken = await TestToken.new({ from: admin })
    await this.testToken.initialize(admin);
    
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
  describe("Initial setup", async () => {
    it("XStarterStaking setup", async () => {
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
      const aliceTierLevelStaked = await this.xStarterStaking.getUserTier(alice);
    })
  })
  describe("SaleFactory", async () => {
    it("Admin can be changed, only admin can give permissions to create new sales.", async () => {
      // Check if admin is set in constructor
      let currentAdmin = await this.saleFactory.admin()
      assert.deepEqual(currentAdmin, admin)
      // Alice can't give permission to create sales, can't change admin
      await expectRevert(this.saleFactory.setSaleCreator(alice, true, {from: alice}), "This function can be used only by admin.")
      await expectRevert(this.saleFactory.changeAdmin(alice, {from: alice}), "This function can be used only by admin.")
      // Admin can change admin, can give permission to create sales
      await this.saleFactory.changeAdmin(alice, {from: admin})
      await this.saleFactory.setSaleCreator(alice, true, {from: alice})
      currentAdmin = await this.saleFactory.admin()
      assert.deepEqual(currentAdmin, alice)
      await this.saleFactory.changeAdmin(admin, {from: alice})
    })
    it("Creates sale and emits a saleCreated event", async () => {
      const blockNumber = await web3.eth.getBlockNumber()
      const block = await web3.eth.getBlock(blockNumber)
      this.currentTimestamp = block.timestamp
      this.tommorow = this.currentTimestamp  + this.SECONDS_IN_DAY
      this.dayAfterTommorow = this.currentTimestamp + 2 * this.SECONDS_IN_DAY
      // Can't create sale without permission
      await expectRevert(this.saleFactory.createNewSale(
        testTokenName,
        this.testToken.address,
        admin,
        this.addDecimals(1000, testTokenDecimals),
        [0, 10, 100, 1000, 1500, 2000, 3000, 10000, 20000].map(value => this.addDecimals(value, testTokenDecimals)),
        this.tommorow,
        this.dayAfterTommorow,
        web3.utils.toWei("2"),
        'description',
        { from: admin }
      ), "You don't have permission to create sales.")
      await this.saleFactory.setSaleCreator(admin, true, {from: admin})
      const saleCreatedReceipt = await this.saleFactory.createNewSale(
        testTokenName,
        this.testToken.address,
        admin,
        this.addDecimals(1000, testTokenDecimals),
        [0, 10, 100, 1000, 1500, 2000, 3000, 10000, 20000].map(value => this.addDecimals(value, testTokenDecimals)),
        this.tommorow,
        this.dayAfterTommorow,
        web3.utils.toWei("2"),
        'description',
        { from: admin }
      );
      expectEvent(saleCreatedReceipt, 'saleCreated');
      this.sale = await Sale.at(saleCreatedReceipt.logs[0].args.saleAddress);

    })
  })
  describe("Before sale starts", async () => {
    it("Check the initial values of the sale", async () => {
      const approved = await this.sale.approved();
      const saleRewardWithdrawn = await this.sale.saleRewardWithdrawn();
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

      assert.deepEqual(approved, false)
      assert.deepEqual(saleRewardWithdrawn, false)
      assert.deepEqual(isSaleActive, false)
      assert.deepEqual(hasSaleEnded, false)
      assert.deepEqual(tokenName, testTokenName)
      assert.deepEqual(tokenAddress, this.testToken.address)
      assert.deepEqual(softcap.toString(), this.addDecimals(1000, testTokenDecimals))
      assert.deepEqual(startTimestamp.toString(), this.tommorow.toString())
      assert.deepEqual(endTimestamp.toString(), this.dayAfterTommorow.toString())
      assert.deepEqual(price.toString(), web3.utils.toWei('2'))
      assert.deepEqual(description, 'description')
      assert.deepEqual(totalTokensSold.toString(), '0')
      assert.deepEqual(aliceTokenBalance.toString(), '0')
    })
    it("Can add tokens for sale", async () => {
      //Mint and approve 100,000 TKN
      await this.testToken.mint(admin, "10000000000000");
      
      await this.testToken.approve(
				this.sale.address,
				"10000000000000",
				{ from: admin }
			)
      await this.sale.addTokensForSale("10000000000000")
     
      const hardcap = await this.sale.hardcap()
      assert.deepEqual(hardcap.toString(), "10000000000000")
    })
    it("Can withdraw tokens if sale hasn't started yet", async () => {
      await expectRevert(this.sale.withdrawTokensFromInvalidSale({from:alice}), "This function can be used only by sale owner!")
      await this.sale.withdrawTokensFromInvalidSale({from:admin})
      let hardcap = await this.sale.hardcap()
      assert.deepEqual(hardcap.toString(), "0")
      const adminBalance = await this.testToken.balanceOf(admin)
      assert.deepEqual(adminBalance.toString(), "10000000000000")
      await this.testToken.approve(
				this.sale.address,
				"10000000000000",
				{ from: admin }
			)
      await this.sale.addTokensForSale("10000000000000")
      hardcap = await this.sale.hardcap()
      assert.deepEqual(hardcap.toString(), "10000000000000")
    })
    it("Only 'TokenCreator' can add tokens to sale", async() => {
      await this.testToken.mint(bob, "10000000000000", {from:admin});
      
      await this.testToken.approve(
				this.sale.address,
				"10000000000000",
				{ from: bob }
			)
      await expectRevert(this.sale.addTokensForSale("10000000000000", {from:bob}), "This function can be used only by sale owner!")
    })
    it("Can approve sale", async () =>{
      let approved = await this.sale.approved();
      assert.deepEqual(approved, false)
      await this.sale.approve({from:admin})
      approved = await this.sale.approved();
      assert.deepEqual(approved, true)
    })
    it("Can change price", async () => {
      // 1 TKN = 0.00001 ETH
      // Alice can't change price
      await expectRevert.unspecified(this.sale.changePrice(web3.utils.toWei('2'), {from: alice}))
      const price = new web3.utils.BN(parseFloat('1') * Math.pow(10, 13));
      await this.sale.changePrice(price.toString(), {from: admin})
      const newPrice = await this.sale.price()
      assert.deepEqual(newPrice.toString(), price.toString())
    })
    it("Sale is not approved after price change", async () => {
      let approved = await this.sale.approved();
      assert.deepEqual(approved, false)
      await this.sale.approve({from:admin})
      approved = await this.sale.approved();
      assert.deepEqual(approved, true)
    })
    it("Can't buy tokens if sale hasn't started yet", async () => {
      await expectRevert(this.sale.buyTokens({ from: alice, value: web3.utils.toWei('1') }), 'This sale has already ended or not started.')
    })
  })
  describe("During sale", async () => {
    it("Can buy tokens when sale started", async () => {
      await this.advanceBlockAtTime(this.tommorow + 10);
      //await this.timeTravel(this.SECONDS_IN_DAY + 60);
      const isSaleActive = await this.sale.isSaleActive();
      assert.deepEqual(isSaleActive, true);
      await expectRevert(this.sale.buyTokens({from:alice, value:'0'}), "Insufficient funds")
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
    it("Can't buy more tokens than tier limit", async () => {
      await expectRevert(this.sale.buyTokens({from:alice, value:web3.utils.toWei('0.1')}), "Your tier is too low to buy this amount of tokens.")
    })
    it("Can't change price when sale has started", async () => {
      await expectRevert(this.sale.changePrice(web3.utils.toWei('2'), {from: admin}), "Sale has already started.")
    })
    it("Can't withdraw funds if sale hasn't ended yet", async () => {
      await expectRevert(this.sale.withdrawFunds({from:alice}), "You can't withdraw when sale is in progress or hasn't started yet.")
    })
    it("Can't withdraw tokens if sale hasn't ended yet", async () => {
      await expectRevert(this.sale.withdrawBoughtTokens({from:alice}), "Sale didn't end or didn't reach softcap.")
    })
    it("Saler can't withdraw sale result ", async () => {
      await expectRevert(this.sale.withdrawSaleResult({from:admin}), "Can withdraw only after approved sale ended.")
    })
    it("Saler can't withdraw tokens from approved sale during sale with withdrawSaleResult function.", async () => {
      await expectRevert(this.sale.withdrawTokensFromInvalidSale({from:admin}), "Sale is valid. Tokens can be withdrawn only after sale ends with withdrawSaleResult function.")
    })
    it("Can't add tokens after sale has started", async () => {
      await this.testToken.mint(admin, "10000000000000", {from:admin});
      
      await this.testToken.approve(
				this.sale.address,
				"10000000000000",
				{ from: admin }
			)
      await expectRevert(this.sale.addTokensForSale("10000000000000", {from:admin}), "Can't add tokens after sale has started.")
    })
  })
  describe("After sale has ended", async () => {
    it("Can withdraw tokens after sale has ended", async () => {
      await this.advanceBlockAtTime(this.dayAfterTommorow + 10);
      const isSaleActive = await this.sale.isSaleActive();
      assert.deepEqual(isSaleActive, false);
      const totalTokensSold = await this.sale.totalTokensSold();
      const softcap = await this.sale.softcap();
      await this.sale.withdrawBoughtTokens({from: alice});
      const randomTokenAliceBalance = await this.testToken.balanceOf(alice);
      assert.deepEqual(randomTokenAliceBalance.toString(), "1000000000000");
      const aliceTokenBalance = await this.sale.tokenBalances(alice);
      assert.deepEqual(aliceTokenBalance.toString(), "0");
      const aliceBalance = await this.sale.balances(alice);
      assert.deepEqual(aliceBalance.toString(), "0");
    })
    it("Can't buy tokens if sale has already ended", async () => {
      await expectRevert(this.sale.buyTokens({ from: alice, value: web3.utils.toWei('1') }), 'This sale has already ended or not started.')
    })
    it("Only people who participated in sale can withdraw bought tokens", async ()=> {
      await expectRevert(this.sale.withdrawBoughtTokens({from: john}), "Insufficient funds.")
      await expectRevert(this.sale.withdrawBoughtTokens({from: bob}), "Insufficient funds.")
      await expectRevert(this.sale.withdrawBoughtTokens({from: sam}), "Insufficient funds.")
    })
    it("Buyer can't withdraw ethereum because sale has reached softcap", async () =>{
      await expectRevert(this.sale.withdrawFunds({from: alice}), "You can't withdraw because sale reached softcap.")
    })
    it("Can't withdraw second time", async () => {
      await expectRevert(this.sale.withdrawBoughtTokens({from: alice}), "Insufficient funds.");
    })
    it("Saler can't withdraw tokens from approved sale using withdrawTokensFromInvalidSale function", async () => {
      await expectRevert(this.sale.withdrawTokensFromInvalidSale({from:admin}), "Sale is valid. Tokens can be withdrawn only after sale ends with withdrawSaleResult function.")
    })
    it("Saler can withdraw excess tokens and sale profit", async () => {
      const balanceBefore = await web3.eth.getBalance(admin);
      const withdrawReceipt = await this.sale.withdrawSaleResult({from:admin});
      const tokenBalance = await this.testToken.balanceOf(admin);
      assert.deepEqual(tokenBalance.toString(), "19000000000000");
      const balanceAfter = await web3.eth.getBalance(admin);
      const gasPrice = await web3.eth.getGasPrice()
      let expectedBalance = new web3.utils.BN(balanceBefore)
      expectedBalance = expectedBalance.add(new web3.utils.BN(web3.utils.toWei('0.1')));
      expectedBalance = expectedBalance.sub(new web3.utils.BN(gasPrice * withdrawReceipt.receipt.gasUsed))
      assert.deepEqual(expectedBalance.toString(), balanceAfter.toString())
      const saleRewardWithdrawn = await this.sale.saleRewardWithdrawn();
      assert.deepEqual(saleRewardWithdrawn, true)
    })
    it("Saler can withdraw only once", async () => {
      await expectRevert(this.sale.withdrawSaleResult({from:admin}), "Sale reward has already been withdrawn")
    })
  })
  describe("Special cases", async () => {
    it("Can't buy tokens if hardcap < softcap", async ()=>{
      const blockNumber = await web3.eth.getBlockNumber()
      const block = await web3.eth.getBlock(blockNumber)
      this.currentTimestamp = block.timestamp
      this.tommorow = this.currentTimestamp  + this.SECONDS_IN_DAY
      this.dayAfterTommorow = this.currentTimestamp + 2 * this.SECONDS_IN_DAY
      const price = new web3.utils.BN(parseFloat('1') * Math.pow(10, 13));
      const saleCreatedReceipt = await this.saleFactory.createNewSale(
        testTokenName,
        this.testToken.address,
        admin,
        this.addDecimals(1000, testTokenDecimals),
        [0, 10, 100, 1000, 1500, 2000, 3000, 10000, 20000].map(value => this.addDecimals(value, testTokenDecimals)),
        this.tommorow,
        this.dayAfterTommorow,
        price.toString(),
        'description',
        { from: admin }
      );
      this.sale = await Sale.at(saleCreatedReceipt.logs[0].args.saleAddress);
      await this.advanceBlockAtTime(this.tommorow + 10);
      const isSaleActive = await this.sale.isSaleActive();
      assert.deepEqual(isSaleActive, true);
      await expectRevert(this.sale.buyTokens({ from: alice, value: web3.utils.toWei('1') }), 'Sale is not approved.')
     
    })
    it("Can't buy tokens if sale is not approved", async ()=>{
      const blockNumber = await web3.eth.getBlockNumber()
      const block = await web3.eth.getBlock(blockNumber)
      this.currentTimestamp = block.timestamp
      this.tommorow = this.currentTimestamp  + this.SECONDS_IN_DAY
      this.dayAfterTommorow = this.currentTimestamp + 2 * this.SECONDS_IN_DAY
      const price = new web3.utils.BN(parseFloat('1') * Math.pow(10, 13));
      const saleCreatedReceipt = await this.saleFactory.createNewSale(
        testTokenName,
        this.testToken.address,
        admin,
        "10000000000000",
        [0, 10, 100, 1000, 1500, 2000, 3000, 10000, 20000].map(value => this.addDecimals(value, testTokenDecimals)),
        this.tommorow,
        this.dayAfterTommorow,
        price.toString(),
        'description',
        { from: admin }
      );
      this.sale = await Sale.at(saleCreatedReceipt.logs[0].args.saleAddress);
      let tokenBalance = await this.testToken.balanceOf(admin);
      assert.deepEqual(tokenBalance.toString(), "19000000000000");
      await this.testToken.approve(
				this.sale.address,
				"19000000000000",
				{ from: admin }
			)
      await this.sale.addTokensForSale("19000000000000", {from: admin})
      await this.advanceBlockAtTime(this.tommorow + 10);
      const isSaleActive = await this.sale.isSaleActive();
      assert.deepEqual(isSaleActive, true);
      await expectRevert(this.sale.buyTokens({ from: alice, value: web3.utils.toWei('1') }), 'Sale is not approved.')
    })
    it("Can't approve if sale has already started", async () => {
      await expectRevert(this.sale.approve({from:admin}), "You can't approve this sale because it has already started.")
    })
    it("Saler can withdraw tokens if sale isn't approved", async () => {
      await this.sale.withdrawTokensFromInvalidSale({from: admin})
      const tokenBalance = await this.testToken.balanceOf(admin);
      assert.deepEqual(tokenBalance.toString(), "19000000000000");
    })
    it("Saler can withdraw tokens if sale didn't reach softcap", async () => {
      const blockNumber = await web3.eth.getBlockNumber()
      const block = await web3.eth.getBlock(blockNumber)
      this.currentTimestamp = block.timestamp
      this.tommorow = this.currentTimestamp  + this.SECONDS_IN_DAY
      this.dayAfterTommorow = this.currentTimestamp + 2 * this.SECONDS_IN_DAY
      const price = new web3.utils.BN(parseFloat('1') * Math.pow(10, 13));
      const saleCreatedReceipt = await this.saleFactory.createNewSale(
        testTokenName,
        this.testToken.address,
        admin,
        "10000000000000",
        [0, 10, 100, 1000, 1500, 2000, 3000, 10000, 20000].map(value => this.addDecimals(value, testTokenDecimals)),
        this.tommorow,
        this.dayAfterTommorow,
        price.toString(),
        'description',
        { from: admin }
      );
      this.sale = await Sale.at(saleCreatedReceipt.logs[0].args.saleAddress);
      let tokenBalance = await this.testToken.balanceOf(admin);
      assert.deepEqual(tokenBalance.toString(), "19000000000000");
      await this.testToken.approve(
				this.sale.address,
				"19000000000000",
				{ from: admin }
			)
      await this.sale.addTokensForSale("19000000000000", {from: admin})
      await this.sale.approve({from: admin})
      const approved = await this.sale.approved()
      assert.deepEqual(approved, true);
      await this.advanceBlockAtTime(this.tommorow + 10);
      const isSaleActive = await this.sale.isSaleActive();
      assert.deepEqual(isSaleActive, true);
      await this.sale.buyTokens({from:alice, value:web3.utils.toWei('0.1')})
      const aliceTokenBalance = await this.sale.tokenBalances(alice);
      assert.deepEqual(aliceTokenBalance.toString(), "1000000000000");
      const aliceBalance = await this.sale.balances(alice);
      assert.deepEqual(aliceBalance.toString(), web3.utils.toWei('0.1').toString());
      await this.advanceBlockAtTime(this.dayAfterTommorow + 10);
      const hasSaleEnded = await this.sale.hasSaleEnded();
      assert.deepEqual(hasSaleEnded, true);
      await this.sale.withdrawSaleResult({from: admin})
      tokenBalance = await this.testToken.balanceOf(admin);
      assert.deepEqual(tokenBalance.toString(), "19000000000000");
    })
    it("Buyer can withdraw ethereum if sale didn't reach softcap", async () => {
      const balanceBefore = await web3.eth.getBalance(alice);
      const withdrawReceipt = await this.sale.withdrawFunds({from: alice})
      const aliceTokenBalance = await this.sale.tokenBalances(alice);
      assert.deepEqual(aliceTokenBalance.toString(), "0");
      const aliceBalance = await this.sale.balances(alice);
      assert.deepEqual(aliceBalance.toString(), "0");
      const balanceAfter = await web3.eth.getBalance(alice);
      const gasPrice = await web3.eth.getGasPrice()
      let expectedBalance = new web3.utils.BN(balanceBefore)
      expectedBalance = expectedBalance.add(new web3.utils.BN(web3.utils.toWei('0.1')));
      expectedBalance = expectedBalance.sub(new web3.utils.BN(gasPrice * withdrawReceipt.receipt.gasUsed))
      assert.deepEqual(expectedBalance.toString(), balanceAfter.toString())
    })
    it("Buyer can't withdraw bought tokens if sale didn't reach softcap", async () => {
      await expectRevert(this.sale.withdrawBoughtTokens({from:alice}), "Sale didn't end or didn't reach softcap.")
    })
    it("Can't buy more tokens than hardcap", async ()=> {
      const blockNumber = await web3.eth.getBlockNumber()
      const block = await web3.eth.getBlock(blockNumber)
      this.currentTimestamp = block.timestamp
      this.tommorow = this.currentTimestamp  + this.SECONDS_IN_DAY
      this.dayAfterTommorow = this.currentTimestamp + 2 * this.SECONDS_IN_DAY
      const price = new web3.utils.BN(parseFloat('1') * Math.pow(10, 13));
      const saleCreatedReceipt = await this.saleFactory.createNewSale(
        testTokenName,
        this.testToken.address,
        admin,
        "10000000000000",
        [0, 10, 100, 1000, 1500, 2000, 3000, 200000, 200000].map(value => this.addDecimals(value, testTokenDecimals)),
        this.tommorow,
        this.dayAfterTommorow,
        price.toString(),
        'description',
        { from: admin }
      );
      this.sale = await Sale.at(saleCreatedReceipt.logs[0].args.saleAddress);
      await this.testToken.approve(
				this.sale.address,
				"19000000000000",
				{ from: admin }
			)
      await this.sale.addTokensForSale("19000000000000", {from: admin})
      await this.sale.approve({from: admin})
      await this.advanceBlockAtTime(this.tommorow + 10);
      const isSaleActive = await this.sale.isSaleActive();
      assert.deepEqual(isSaleActive, true);
      await expectRevert(this.sale.buyTokens({from:alice, value:web3.utils.toWei('2')}), "Contract doesn't have sufficient amount of tokens.")
    })
    it("Can't add tokens to declined sale", async ()=> {
      const blockNumber = await web3.eth.getBlockNumber()
      const block = await web3.eth.getBlock(blockNumber)
      this.currentTimestamp = block.timestamp
      this.tommorow = this.currentTimestamp  + this.SECONDS_IN_DAY
      this.dayAfterTommorow = this.currentTimestamp + 2 * this.SECONDS_IN_DAY
      const price = new web3.utils.BN(parseFloat('1') * Math.pow(10, 13));
      const saleCreatedReceipt = await this.saleFactory.createNewSale(
        testTokenName,
        this.testToken.address,
        admin,
        "10000000000000",
        [0, 10, 100, 1000, 1500, 2000, 3000, 200000, 200000].map(value => this.addDecimals(value, testTokenDecimals)),
        this.tommorow,
        this.dayAfterTommorow,
        price.toString(),
        'description',
        { from: admin }
      );
      this.sale = await Sale.at(saleCreatedReceipt.logs[0].args.saleAddress);
      await this.testToken.mint(admin, "10000000000000");
      await this.testToken.approve(
				this.sale.address,
				"10000000000000",
				{ from: admin }
			)
      await this.sale.addTokensForSale("10000000000000", {from: admin})
      //Only admin cal decline sale
      await expectRevert(this.sale.decline({from:bob}), "This function can be used only by admin.")
      await this.sale.decline({from:admin})
      const isDeclined = await this.sale.declined()
      assert.deepEqual(isDeclined, true);
      await this.testToken.mint(admin, "9000000000000");
      await this.testToken.approve(
				this.sale.address,
				"9000000000000",
				{ from: admin }
			)
      await expectRevert(this.sale.addTokensForSale("9000000000000", {from: admin}), "You can't add tokens to declined sales.")

     
    })
    it("Can't approve declined sale", async ()=> {
      await expectRevert(this.sale.approve({from: admin}), "Sale is already declined.")
    })
    it("Can't change price in declined sale", async ()=> {
      await expectRevert(this.sale.changePrice("1", {from: admin}), "Sale is declined.")
    })
    it("Can't participate in declined sale", async () => {
      await this.advanceBlockAtTime(this.tommorow + 10);
      const isSaleActive = await this.sale.isSaleActive();
      assert.deepEqual(isSaleActive, true);
      await expectRevert.unspecified(this.sale.buyTokens({from:alice, value:web3.utils.toWei('0.1')}))
    })
    it("Saler can withdraw tokens in declined sale", async () => {
      await this.sale.withdrawTokensFromInvalidSale({from:admin})
      const adminBalance = await this.testToken.balanceOf(admin)
      assert.deepEqual(adminBalance.toString(), "19000000000000");
    })
    it("Saler can withdraw his tokens if sale wasn't approved and started", async () => {
      const blockNumber = await web3.eth.getBlockNumber()
      const block = await web3.eth.getBlock(blockNumber)
      this.currentTimestamp = block.timestamp
      this.tommorow = this.currentTimestamp  + this.SECONDS_IN_DAY
      this.dayAfterTommorow = this.currentTimestamp + 2 * this.SECONDS_IN_DAY
      const price = new web3.utils.BN(parseFloat('1') * Math.pow(10, 13));
      const saleCreatedReceipt = await this.saleFactory.createNewSale(
        testTokenName,
        this.testToken.address,
        admin,
        "10000000000000",
        [0, 10, 100, 1000, 1500, 2000, 3000, 200000, 200000].map(value => this.addDecimals(value, testTokenDecimals)),
        this.tommorow,
        this.dayAfterTommorow,
        price.toString(),
        'description',
        { from: admin }
      );
      this.sale = await Sale.at(saleCreatedReceipt.logs[0].args.saleAddress);
      await this.testToken.approve(
				this.sale.address,
				"10000000000000",
				{ from: admin }
			)
      await this.sale.addTokensForSale("10000000000000", {from: admin})
      await this.advanceBlockAtTime(this.tommorow + 10);
      const isSaleActive = await this.sale.isSaleActive();
      assert.deepEqual(isSaleActive, true);
      const isApproved = await this.sale.approved()
      assert.deepEqual(isApproved, false);
      await this.sale.withdrawTokensFromInvalidSale({from:admin})
      const adminBalance = await this.testToken.balanceOf(admin)
      assert.deepEqual(adminBalance.toString(), "19000000000000");
    })
  })
})