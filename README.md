# Arbitrager

This is an implementation of a basic arbitrager between any two UniswapV2 implementations like Uniswap, Sushiswap, Shibaswap, etc. The main contract is Arbitrager, with the function `arbitrage`. 

### Deploy the contract:

For deploying the contract to hardhat or rinkeby test network, clone the project and `cd` into the project directory. The following steps should then be followed:

```
npm install
npx hardhat run scripts/deploy.js --network <network>
```

This would begin by first installing all the necessary node dependencies. If the script is deployed to hardhat local network, no other configuration is needed and the script would arbitrage between two mock WETH/DAI pools having custom WETH, DAI reserves to ensure arbitrage opportunity. 

If the deployment network is rinkeby, the account's private key and the alchemy api key need to be scpecified in a new config `secrets.json`(a `sample-secrets.json` has also been created for easy reference). 

### Deploy the bot:

The contract Arbitrager has a function `computeProfitMaximizingTrade` which takes two UniswapV2 pool addresses as input parameters, and checks if there is an arbitrage possibility. If present, it undergoes the arbitrage using flash swap, in the same transaction. It also emits an event `ProfitMaximizingTrade` which has details regarding the swap direction and amount of tokens swapped (if arbitrage is executed). The bot can be started by `npx hardhat run scripts/subscribe.js` or simply

```
npm start
```

This requires setting up the `secrets.json` as before. The arbitrager address and the network can also be changed in the script. The entire profit from arbitrage is stored in the arbitrager itself.  

### Running tests:

This ensures that there is always a profit when arbitrage opportunity exists between two UniswapV2 pools. The tests are always run on the default hardhat network. They can be started by `npx hardhat test` or

```
npm test 
```
