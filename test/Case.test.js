const { assert } = require("chai")
const { ether } = require("@openzeppelin/test-helpers")

const TokenProxy = artifacts.require("TokenProxy")
const XStarterToken = artifacts.require("XStarterToken")
const CaseToken_V2 = artifacts.require("CaseToken_V2")
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const { web3 } = require("@openzeppelin/test-helpers/src/setup")
contract("Test XStarter Token", function (accounts) {
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
      await this.tokenInstance.initialize(admin, "10000000000000", 10)
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
    it("Mint tokens", async () => {
      const mp = await this.tokenInstance.mintPeriods(0)
      await expectRevert(this.tokenInstance.mint(admin, "2000000000000"), "Can't mint more than permitted amount!")
      await this.tokenInstance.mint(admin, "500000000000")
      let balance = await this.tokenInstance.balanceOf(admin)
      assert.deepEqual(balance.toString(), "10500000000000")
      await expectRevert(this.tokenInstance.mint(admin, "500100000000"), "Can't mint more than permitted amount!")
      await this.tokenInstance.mint(admin, "500000000000")
      balance = await this.tokenInstance.balanceOf(admin)
      assert.deepEqual(balance.toString(), "11000000000000")
      await this.timeTravel(94608100)
      await expectRevert(this.tokenInstance.mint(admin, "500100000000"), "Next mint permit rate not assigned yet!")
      await this.tokenInstance.grantDAORole(alice, {from: admin})
      await this.tokenInstance.assignOwnerMintPermitRate(20, {from: alice})
      await this.tokenInstance.mint(admin, "1500000000000")
      await expectRevert(this.tokenInstance.mint(admin, "500100000000"), "Can't mint more than permitted amount!")
      await this.tokenInstance.mint(admin, "500000000000")
      balance = await this.tokenInstance.balanceOf(admin)
      assert.deepEqual(balance.toString(), "13000000000000")
      await this.tokenInstance.assignOwnerMintPermitRate(15, {from: alice})
      await expectRevert(this.tokenInstance.assignOwnerMintPermitRate(15, {from: alice}), "You can only assign permit rate on one year ahead!")
      await expectRevert(this.tokenInstance.mint(admin, "500100000000"), "Can't mint more than permitted amount!")
      // latestBlock = await web3.eth.getBlock('latest')
      // currentTimestamp = latestBlock.timestamp
      // await this.advanceBlockAtTime(currentTimestamp + 31536000)
      await this.timeTravel(31536000)
      await this.tokenInstance.mint(admin, "1500000000000")
      balance = await this.tokenInstance.balanceOf(admin)
      assert.deepEqual(balance.toString(), "14500000000000")
    })

  })

  // describe("Mint tokens and changed allowance before upgrading", () => {
  //   it("Mint tokens", async () => {
  //     let balance = await this.tokenInstance.balanceOf(alice)
  //     assert.deepEqual(balance.toString(), "0")

  //     await this.tokenInstance.mint(alice, ether("100"), { from: admin })

  //     balance = await this.tokenInstance.balanceOf(alice)
  //     assert.deepEqual(balance.toString(), ether("100").toString())
  //   })

  //   it("Approve tokens", async () => {
  //     let allowance = await this.tokenInstance.allowance(alice, bob)
  //     assert.deepEqual(allowance.toString(), "0")

  //     await this.tokenInstance.approve(bob, ether("50"), { from: alice })

  //     allowance = await this.tokenInstance.allowance(alice, bob)
  //     assert.deepEqual(allowance.toString(), ether("50").toString())
  //   })

  //   it("Burn tokens", async () => {
  //     let balance = await this.tokenInstance.balanceOf(alice)
  //     await this.tokenInstance.burn(ether("100"), { from: alice } )
  //     balance = await this.tokenInstance.balanceOf(alice)
  //     assert.deepEqual(balance.toString(), "0")
  //   })
  // })

  // describe("Deploy and upgrade token contract to V2", () => {
  //   it("Deploy and upgrade V2", async () => {
  //     this.logicInstance = await CaseToken_V2.new({ from: admin })
  //     await this.proxyInstance.upgradeTo(this.logicInstance.address, {
  //       from: proxyAdmin,
  //     })
  //     this.tokenInstance = await CaseToken_V2.at(this.proxyInstance.address)
  //   })

  //   it("Check the contract initial values after upgrade", async () => {
  //     const name = await this.tokenInstance.name()
  //     const symbol = await this.tokenInstance.symbol()
  //     const decimals = await this.tokenInstance.decimals()

  //     assert.deepEqual(name, "XStarter")
  //     assert.deepEqual(symbol, "XST")
  //     assert.deepEqual(decimals.toString(), "8")
  //   })

  //   it("Check the balance and allowances after upgrade", async () => {
  //     const allowance = await this.tokenInstance.allowance(alice, bob)
  //     assert.deepEqual(allowance.toString(), ether("50").toString())
  //   })
  // })

  // describe("Use the new method of V2 token", () => {
  //   it("Called the new method", async () => {
  //     await this.tokenInstance.changeTokenData("NEW TEST CASE", "NTC", "10") // DON'T RECOMMENDED to change decimal of contract on production!

  //     const name = await this.tokenInstance.name()
  //     const symbol = await this.tokenInstance.symbol()
  //     const decimals = await this.tokenInstance.decimals()

  //     assert.deepEqual(name, "NEW TEST CASE")
  //     assert.deepEqual(symbol, "NTC")
  //     assert.deepEqual(decimals.toString(), "10")
  //   })
  // })
})
