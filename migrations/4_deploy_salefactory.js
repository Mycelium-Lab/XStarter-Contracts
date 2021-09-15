const XStarterStaking = artifacts.require("XStarterStaking")
const SaleFactory = artifacts.require("SaleFactory")
module.exports = (deployer, network, accounts) => {
  const [admin] = accounts
  deployer.then(async () => { 
    const xStarterStaking = await XStarterStaking.deployed();
    await deployer.deploy(SaleFactory, admin, xStarterStaking.address);
  })
}
