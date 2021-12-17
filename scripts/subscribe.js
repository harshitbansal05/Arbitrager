const { ethers } = require("ethers");
const { config } = require("../config");
const { privateKey, alchemyApiKey } = require("../secrets");
const Arbitrager = require("../artifacts/contracts/Arbitrager.sol/Arbitrager.json");

const network = { name: "rinkeby" };
const provider = new ethers.providers.AlchemyProvider( 
  network.name,
  alchemyApiKey
);
const wallet = new ethers.Wallet(privateKey, provider);

const uniswapDaiWethPoolAddress = config["daiWethPoolAddress"]["uniswap"][network.name];
const arbitragerAddress = "0x3c600d9246F769Ac54E8e8B067c22A6cc1E10D5d";
const flashSwapAddress = "0xBCbE8bF928A3D3811E850B999540A91bC6a2A786";

// This ABI object works for both Uniswap and SushiSwap
const uniswapAbi = [
  "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)",
];

const uniswapContract = new ethers.Contract(
  uniswapDaiWethPoolAddress,
  uniswapAbi,
  wallet
);
const filter = uniswapContract.filters.Swap();

const arbitrager = new ethers.Contract(
  arbitragerAddress,
  Arbitrager.abi,
  wallet
);

uniswapContract.on(filter, async (from, a0in, a0out, a1in, a1out, to, e) => {
  console.log("Swap event received");

  // Get necessary addresses depending on config
  const daiAddress = config["daiAddress"][network.name];
  const wethAddress = config["wethAddress"][network.name];
  const uniswapV2FactoryAddress = config["factoryAddress"]["uniswap"][network.name];
  const sushiswapV2FactoryAddress = config["factoryAddress"]["sushiswap"][network.name];
  const sushiswapDaiWethPoolAddress = config["daiWethPoolAddress"]["sushiswap"][network.name];

  // Run arbitrage. It itself checks if there is a 
  // arbitrage opportunity
  const arbitrageTx = await arbitrager.arbitrage(
    uniswapV2FactoryAddress, 
    sushiswapV2FactoryAddress,
    uniswapDaiWethPoolAddress,
    sushiswapDaiWethPoolAddress,
    daiAddress,
    wethAddress,
    flashSwapAddress,
    true
  );
  const arbitrageTxReceipt = await arbitrageTx.wait();
  const event = arbitrageTxReceipt.events[0];
  const aToB = event.args.aToB;
  const amountIn = event.args.amountIn; 
  const reservesExchangeATokenA = event.args.reservesExchangeATokenA;
  const reservesExchangeATokenB = event.args.reservesExchangeATokenB;
  const reservesExchangeBTokenA = event.args.reservesExchangeBTokenA;
  const reservesExchangeBTokenB = event.args.reservesExchangeBTokenB;
  
  console.log("Reserves Uniswap DAI: %d", reservesExchangeATokenA);
  console.log("Reserves Uniswap WETH: %d", reservesExchangeATokenB);
  console.log("Reserves Sushiswap DAI: %d", reservesExchangeBTokenA);
  console.log("Reserves Sushiswap WETH: %d", reservesExchangeBTokenB);
  
  if(amountIn > 0) console.log(`Arbitrage executed by flash swapping ${amountIn} ${aToB ? "DAI" : "WETH"} from Uniswap`);
  else console.log("Arbitrage not porfitable");
});
