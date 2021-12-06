const XStarterToken = artifacts.require("XStarterToken")
const TokenProxy = artifacts.require("TokenProxy")
const XStarterStaking = artifacts.require("XStarterStaking")

module.exports = (deployer, network, accounts) => {
  const [admin] = accounts
  const decimals = "0".repeat(8);
  const DEFAULT_TIER_VALUES = [0, 10, 50, 100, 250, 500, 750, 1000].map( value => value + decimals);
  deployer.then(async () => { 
    const proxyInstance = await TokenProxy.deployed()
    const tokenInstance = await XStarterToken.at(proxyInstance.address)
  
    const xStarterStaking = await deployer.deploy(XStarterStaking, proxyInstance.address, admin, DEFAULT_TIER_VALUES)
    // const minter_role = await tokenInstance.MINTER_ROLE()
    // await tokenInstance.grantRole(minter_role, xStarterStaking.address, {
    //   from: admin,
    // })
  })
}