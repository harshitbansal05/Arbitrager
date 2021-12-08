// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers, network } = require("hardhat");
const { config } = require("../config");

async function deploy_mocks() {
  console.log("Deploying mocks...");
  const account = await hre.ethers.getSigners();

  // Deploy mock DAI, WETH tokens
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const dai = await MockERC20.deploy("Mock DAI", "DAI", account[0], 10000000000);
  await dai.deployed();
  console.log("DAI deployed to:", dai.address);

  const weth = await MockERC20.deploy("Mock WETH", "WETH", account[0], 10000000000);
  await weth.deployed();
  console.log("WETH deployed to:", weth.address);

  // Deploy mock Uniswap, Sushiswap factory
  const MockUniswapV2Factory = await hre.ethers.getContractFactory("MockUniswapV2Factory");
  const mockUniswapV2Factory = await MockUniswapV2Factory.deploy(account[0]);
  await mockUniswapV2Factory.deployed();
  console.log("MockUniswapV2Factory deployed to:", mockUniswapV2Factory.address);

  const mockSushiswapV2Factory = await MockUniswapV2Factory.deploy(account[0]);
  await mockSushiswapV2Factory.deployed();
  console.log("MockSushiswapV2Factory deployed to:", mockSushiswapV2Factory.address);

  // Create dai <-> weth pairs in Uniswap, Sushiswap 
  await mockUniswapV2Factory.createPair(dai, weth);
  await mockSushiswapV2Factory.createPair(dai, weth);

  // Deploy helper libraries
  const UniswapV2Library = await hre.ethers.getContractFactory("UniswapV2Library");
  const library = await UniswapV2Library.deploy();
  await library.deployed();
  console.log("UniswapV2Library deployed to:", library.address);

  const TransferHelper = await hre.ethers.getContractFactory("TransferHelper");
  const transferHelper = await TransferHelper.deploy();
  await transferHelper.deployed();
  console.log("TransferHelper deployed to:", transferHelper.address);

  // Get dai <-> weth pool address for Uniswap, Sushiswap
  const uniswapDaiWethPool = await library.pairFor(mockUniswapV2Factory, dai, weth);
  const sushiswapDaiWethPool = await library.pairFor(mockSushiswapV2Factory, dai, weth);

  // Add initial liquidity in dai <-> weth pools
  await transferHelper.safeTransferFrom(dai, account[0], uniswapDaiWethPool, 10000);
  await transferHelper.safeTransferFrom(weth, account[0], uniswapDaiWethPool, 100);

  await transferHelper.safeTransferFrom(dai, account[0], sushiswapDaiWethPool, 5000);
  await transferHelper.safeTransferFrom(weth, account[0], sushiswapDaiWethPool, 100);

  await hre.ethers.getContractAt(uniswapDaiWethPool).mint(account[0]);
  await hre.ethers.getContractAt(sushiswapDaiWethPool).mint(account[0]);

  return [dai, weth, mockUniswapV2Factory, mockSushiswapV2Factory];
}

async function main() {
  const daiAddress = config["daiAddress"][network.name];
  const wethAddress = config["wethAddress"][network.name];
  const uniswapV2FactoryAddress = config["factoryAddress"]["uniswap"][network.name];
  const sushiswapV2FactoryAddress = config["factoryAddress"]["sushiswap"][network.name];

  const UniswapFactory = await hre.ethers.getContractFactory("MockUniswapV2Factory");
  const uniswapFactory = await UniswapFactory.attach(uniswapV2FactoryAddress);
  const uniswapDaiWethPoolAddress = await uniswapFactory.getPair(daiAddress, wethAddress);

  const sushiswapFactory = await UniswapFactory.attach(sushiswapV2FactoryAddress);
  const sushiswapDaiWethPoolAddress = await sushiswapFactory.getPair(daiAddress, wethAddress);
  return [uniswapDaiWethPoolAddress, sushiswapDaiWethPoolAddress];
}

async function mainA() {
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

  // const [owner] = await ethers.getSigners();
  // await owner.sendTransaction({
  //   to: flashSwap.address,
  //   value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
  // });
  // await owner.sendTransaction({
  //   to: arbitrager.address,
  //   value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
  // });
  // console.log("Sent ethers to contracts");
  
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

    arbitrageTx = await arbitrager.arbitrage(
      uniswapV2FactoryAddress, 
      sushiswapV2FactoryAddress,
      uniswapDaiWethPoolAddress,
      sushiswapDaiWethPoolAddress,
      daiAddress,
      wethAddress,
      flashSwap.address,
      true
    );
    
    const arbitrageTxReceipt = await arbitrageTx.wait();
    const events = arbitrageTxReceipt.events;
    console.log(events);

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
