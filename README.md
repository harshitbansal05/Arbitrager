# Arbitrager

This is an implementation of a basic arbitrager between any two UniswapV2 implementations like Uniswap, Sushiswap, Shebaswap, etc. The main contract is Arbitrager, with the function `aritrage`. 

### Deploy the contract:

For deploying the contract to hardhat or rinkeby test network, the following steps should be followed:

```
npm install
npx hardhat run scripts/deploy.js --network <network>
```

This would begin by first installing all the necessary node dependencies. If the script is deployed to hardhat local network, no other configuration is needed and the script would arbitrage between two mock WETH/DAI pools having custom WETH, DAI reserves to ensure arbitrage opportunity. 

If the deployment network is rinkeby, the account's private key and the alchemy api key need to be scpecified in a new config `secrets.json`(a `sample-secrets.json` has also been created for easy reference). 

### Running tests:

This ensures that there is always a profit when arbitrage opportunity exists between two UniswapV2 pools.

```
npx hardhat test 
```
