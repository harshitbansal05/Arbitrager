// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers, network } = require("hardhat");
const { config } = require("../config");
const { deployMocks } = require("../scripts/helpful_scripts");

const logEvents = true;

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to   make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const FlashSwap = await hre.ethers.getContractFactory("FlashSwap");
  const flashSwap = await FlashSwap.deploy();
  await flashSwap.deployed();
  console.log("FlashSwap deployed to:", flashSwap.address);

  const Arbitrager = await hre.ethers.getContractFactory("Arbitrager");
  const arbitrager = await Arbitrager.deploy();
  await arbitrager.deployed();
  console.log("Arbitrager deployed to:", arbitrager.address);

  const [owner] = await ethers.getSigners();
  await owner.sendTransaction({
    to: flashSwap.address,
    value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
  });
  await owner.sendTransaction({
    to: arbitrager.address,
    value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
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
    const ERC20 = await hre.ethers.getContractFactory("ERC20");
    const dai = await ERC20.attach(daiAddress);
    const weth = await ERC20.attach(wethAddress);

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

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
