const { assert } = require("chai")
const { ether } = require("@openzeppelin/test-helpers")

const TokenProxy = artifacts.require("TokenProxy")
const XStarterToken = artifacts.require("XStarterToken")
const XStarterStaking = artifacts.require("XStarterStaking")
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const { web3 } = require("@openzeppelin/test-helpers/src/setup")
contract("XStarterToken", function (accounts) {
  const [admin, proxyAdmin, alice, bob] = accounts

  before(async () => {
    this.logicInstance = await XStarterToken.new({ from: admin })
    this.proxyInstance = await TokenProxy.new(
      this.logicInstance.address,
      proxyAdmin,
      "0x"
    )
    this.tokenInstance = await XStarterToken.at(this.proxyInstance.address)

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
    this.timeTravel = async (seconds) => {
      let latestBlock = await web3.eth.getBlock('latest')
      let currentTimestamp = latestBlock.timestamp
      return this.advanceBlockAtTime(currentTimestamp + seconds)
    }
  })
  describe("Check initial values and init the token contract", () => {
    it("Checks the initial values of the contract", async () => {
      const name = await this.tokenInstance.name()
      const symbol = await this.tokenInstance.symbol()
      const decimals = await this.tokenInstance.decimals()

      assert.deepEqual(name, "")
      assert.deepEqual(symbol, "")
      assert.deepEqual(decimals.toString(), "0")
    })

    it("Init contact values", async () => {
      const decimals = "0".repeat(8);
      const DEFAULT_TIER_VALUES = [0, 10, 50, 100, 250, 500, 750, 1000].map( value => value + decimals);
      const xStarterStaking = await XStarterStaking.new(proxyInstance.address, admin, DEFAULT_TIER_VALUES, 20)
      await this.tokenInstance.initialize(admin, "10000000000000", 10, xStarterStaking.address)
    })

    it("Checks the values after init", async () => {
      const name = await this.tokenInstance.name()
      const symbol = await this.tokenInstance.symbol()
      const decimals = await this.tokenInstance.decimals()

      assert.deepEqual(name, "XStarter")
      assert.deepEqual(symbol, "XST")
      assert.deepEqual(decimals.toString(), "8")
      let ownerAddress = await this.tokenInstance.ownerAddress();
      assert.deepEqual(admin, ownerAddress)
      let totalsupply = await this.tokenInstance.totalSupply();
      assert.deepEqual(totalsupply.toString(), "10000000000000")
      let balance = await this.tokenInstance.balanceOf(admin)
      assert.deepEqual(balance.toString(), "10000000000000")
    })
  })
    describe("Mint tokens and changed allowance before upgrading", () => {
      it("Owner can mint tokens first three years 10% of initial supply", async () => {
        const mp = await this.tokenInstance.mintPeriods(0)
        await expectRevert(this.tokenInstance.mint(admin, "2000000000000"), "Can't mint more than permitted amount!")
        await this.tokenInstance.mint(admin, "500000000000")
        let balance = await this.tokenInstance.balanceOf(admin)
        assert.deepEqual(balance.toString(), "10500000000000")
        await expectRevert(this.tokenInstance.mint(admin, "500100000000"), "Can't mint more than permitted amount!")
        await this.tokenInstance.mint(admin, "500000000000")
        balance = await this.tokenInstance.balanceOf(admin)
        assert.deepEqual(balance.toString(), "11000000000000")
      })
      it("Owner can't mint tokens if dao doesn't assign next permit mint rate", async () => {
        await this.timeTravel(94608100)
        await expectRevert(this.tokenInstance.mint(admin, "500100000000"), "Next mint permit rate not assigned yet!")
      })
      it("Dao can be assigned only by owner and only one time", async () => {
        await expectRevert(this.tokenInstance.grantDAORole(alice, {from: alice}), "Only contract owner can call this function!")
        await this.tokenInstance.grantDAORole(alice, {from: admin})
        await expectRevert(this.tokenInstance.grantDAORole(bob, {from: admin}), "DAO role is already granted!")
      })
      it("Only dao can assign next permit rate", async () => {
        await expectRevert(this.tokenInstance.assignOwnerMintPermitRate(20, {from: admin}), "Only assigned DAO can call this function!")
        await this.tokenInstance.assignOwnerMintPermitRate(20, {from: alice})
      })
      it("Owner can mint tokens if dao assigns next permit rate", async () => {
        await this.tokenInstance.mint(admin, "1500000000000")
        await expectRevert(this.tokenInstance.mint(admin, "500100000000"), "Can't mint more than permitted amount!")
        await this.tokenInstance.mint(admin, "500000000000")
        balance = await this.tokenInstance.balanceOf(admin)
        assert.deepEqual(balance.toString(), "13000000000000")
      })
      it("Dao can assign new permit rate only for one year ahead", async () => {
        await this.tokenInstance.assignOwnerMintPermitRate(15, {from: alice})
        await expectRevert(this.tokenInstance.assignOwnerMintPermitRate(15, {from: alice}), "You can only assign permit rate on one year ahead!")
        await expectRevert(this.tokenInstance.mint(admin, "500100000000"), "Can't mint more than permitted amount!")
      })
      it("Owner can mint tokens if dao assigns next permit rate", async() =>{
        await this.timeTravel(31536000)
        await this.tokenInstance.mint(admin, "1500000000000")
        balance = await this.tokenInstance.balanceOf(admin)
        assert.deepEqual(balance.toString(), "14500000000000")
      })
      it("Owner can't mint tokens if dao doesn't assign next permit rate", async() =>{
        await this.timeTravel(31539000)
        await expectRevert(this.tokenInstance.mint(admin, "100"), "Next mint permit rate not assigned yet!")
      })
      it("Only dao can change dao address", async() =>{
        await expectRevert(this.tokenInstance.changeDAOAddress(bob, {from: admin}), "Only assigned DAO can call this function!")
        await this.tokenInstance.changeDAOAddress(bob, {from: alice})
        let currentDaoAddress = await this.tokenInstance.daoAddress();
        assert.deepEqual(currentDaoAddress, bob)
        await this.tokenInstance.changeDAOAddress(alice, {from: bob})
        currentDaoAddress = await this.tokenInstance.daoAddress();
        assert.deepEqual(currentDaoAddress, alice)
      })

  })
})
