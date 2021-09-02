const CaseStaking = artifacts.require("CaseStaking")
const SaleFactory = artifacts.require("SaleFactory")
module.exports = (deployer, network, accounts) => {
  const [admin] = accounts
  deployer.then(async () => { 
    const caseStaking = await CaseStaking.deployed();
    await deployer.deploy(SaleFactory, admin, caseStaking.address);
  })
}
