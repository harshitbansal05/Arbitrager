const { ethers, network } = require("hardhat");
const { config } = require("../config");
const { deployMocks } = require("../scripts/helpful_scripts");

const logEvents = true;

async function main() {
  // We get the contract to deploy
  const FlashSwap = await ethers.getContractFactory("FlashSwap");
  const flashSwap = await FlashSwap.deploy();
  await flashSwap.deployed();
  console.log("FlashSwap deployed to:", flashSwap.address);

  const Arbitrager = await ethers.getContractFactory("Arbitrager");
  const arbitrager = await Arbitrager.deploy();
  await arbitrager.deployed();
  console.log("Arbitrager deployed to:", arbitrager.address);

  const [owner] = await ethers.getSigners();
  await owner.sendTransaction({
    to: flashSwap.address,
    value: ethers.utils.parseEther("0.1"), // Sends exactly 0.1 ether
  });
  await owner.sendTransaction({
    to: arbitrager.address,
    value: ethers.utils.parseEther("0.1"), // Sends exactly 0.1 ether
  });
  console.log("Sent ethers to contracts");
  
  if(!(network.name == "hardhat")) {
    // GET DAI, WETH, Uniswap, Sushiswap addresses at the network chain
    const daiAddress = config["daiAddress"][network.name];
    const wethAddress = config["wethAddress"][network.name];
    const uniswapV2FactoryAddress = config["factoryAddress"]["uniswap"][network.name];
    const sushiswapV2FactoryAddress = config["factoryAddress"]["sushiswap"][network.name];
    const uniswapDaiWethPoolAddress = config["daiWethPoolAddress"]["uniswap"][network.name];
    const sushiswapDaiWethPoolAddress = config["daiWethPoolAddress"]["sushiswap"][network.name];

    // GET DAI, WETH contracts
    const ERC20 = await ethers.getContractFactory("ERC20");
    const dai = ERC20.attach(daiAddress);
    const weth = ERC20.attach(wethAddress);

    // Get initial DAI, WETH balance of arbitrager
    const initialDaiBalance = await dai.balanceOf(arbitrager.address);
    const initialWethBalance = await weth.balanceOf(arbitrager.address);

    // Arbitrage
    const arbitrageTx = await arbitrager.arbitrage(
      uniswapV2FactoryAddress, 
      sushiswapV2FactoryAddress,
      uniswapDaiWethPoolAddress,
      sushiswapDaiWethPoolAddress,
      daiAddress,
      wethAddress,
      flashSwap.address,
      true
    );
    
    // Get reserves by listening to events
    const arbitrageTxReceipt = await arbitrageTx.wait();
    const events = arbitrageTxReceipt.events;
    if (logEvents) console.log(events);

    // Get final DAI, WETH balance of arbitrager
    const finalDaiBalance = await dai.balanceOf(arbitrager.address);
    const finalWethBalance = await weth.balanceOf(arbitrager.address);

    // Compute profit
    const daiProfit = finalDaiBalance - initialDaiBalance;
    const wethProfit = finalWethBalance - initialWethBalance;
    console.log("DAI Profit: %d", daiProfit);
    console.log("WETH Profit: %d", wethProfit);
  } else {
    [
      dai, 
      weth, 
      mockUniswapV2Factory, 
      mockSushiswapV2Factory, 
      uniswapDaiWethPoolAddress, 
      sushiswapDaiWethPoolAddress
    ] = await deployMocks();

    // Get initial DAI, WETH balance of arbitrager
    const initialDaiBalance = await dai.balanceOf(arbitrager.address);
    const initialWethBalance = await weth.balanceOf(arbitrager.address);
    
    // Arbitrage
    await arbitrager.arbitrage(
      mockUniswapV2Factory.address, 
      mockSushiswapV2Factory.address,
      uniswapDaiWethPoolAddress,
      sushiswapDaiWethPoolAddress, 
      dai.address, 
      weth.address,
      flashSwap.address,
      true
    );

    // Get final DAI, WETH balance of arbitrager
    const finalDaiBalance = await dai.balanceOf(arbitrager.address);
    const finalWethBalance = await weth.balanceOf(arbitrager.address);

    // Compute profit
    const daiProfit = finalDaiBalance - initialDaiBalance;
    const wethProfit = finalWethBalance - initialWethBalance;
    console.log("DAI Profit: %d", daiProfit);
    console.log("WETH Profit: %d", wethProfit);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
