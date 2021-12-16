require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");

const { alchemyApiKey, etherscanApiKey, privateKey } = require("./secrets.json");

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.4",
        settings: {},
      },
      {
        version: "0.5.16",
      }
    ],
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
    },
    rinkeby: {
      url: `https://eth-rinkeby.alchemyapi.io/v2/${alchemyApiKey}`,
      accounts: [ privateKey ],
      gas: 2100000,
      gasPrice: 8000000000,
    }
  },
  etherscan: {
    apiKey: etherscanApiKey
  }
};
