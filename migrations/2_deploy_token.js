const XStarterToken = artifacts.require("XStarterToken")
const TokenProxy = artifacts.require("TokenProxy")

module.exports = (deployer, network, accounts) => {
  const [admin, proxyAdmin] = accounts
  deployer.then(async () => {
    const tokenInstance = await deployer.deploy(XStarterToken)
    const proxyInstance = await deployer.deploy(
      TokenProxy,
      tokenInstance.address,
      proxyAdmin,
      "0x"
    )

    const tokenBoundToProxy = await XStarterToken.at(proxyInstance.address)
    
  })
}
