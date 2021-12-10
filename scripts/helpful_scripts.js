const { ethers, network } = require("hardhat");
const { config } = require("../config");

exports.getDaiWethPoolAddress = async function () {
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

exports.deployMocks = async function () {
  console.log("Deploying mocks...");
  const accounts = await ethers.getSigners();
  const account = [accounts[0].address];

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
  const uniswapDaiWethPoolTx = await mockUniswapV2Factory.createPair(dai.address, weth.address);
  const uniswapDaiWethPoolTxReceipt = await uniswapDaiWethPoolTx.wait();
  const uniswapDaiWethPoolEvent = uniswapDaiWethPoolTxReceipt.events[0];
  const uniswapDaiWethPoolAddress = uniswapDaiWethPoolEvent.args.pair;
  console.log("Uniswap DAI <-> WETH pool created at:", uniswapDaiWethPoolAddress);

  const sushiswapDaiWethPoolTx = await mockSushiswapV2Factory.createPair(dai.address, weth.address);
  const sushiswapDaiWethPoolTxReceipt = await sushiswapDaiWethPoolTx.wait();
  const sushiswapDaiWethPoolEvent = sushiswapDaiWethPoolTxReceipt.events[0];
  const sushiswapDaiWethPoolAddress = sushiswapDaiWethPoolEvent.args.pair;
  console.log("Sushiswap DAI <-> WETH pool created at:", sushiswapDaiWethPoolAddress);
  
  // Add initial liquidity in dai <-> weth pools
  await dai.transfer(uniswapDaiWethPoolAddress, 100000);
  await weth.transfer(uniswapDaiWethPoolAddress, 1000);

  await dai.transfer(sushiswapDaiWethPoolAddress, 500000000);
  await weth.transfer(sushiswapDaiWethPoolAddress, 1000);

  // Mint LP tokens
  await mockUniswapV2Factory.setFeeTo(mockUniswapV2Factory.address);
  const UniswapV2Pair = await hre.ethers.getContractFactory("UniswapV2Pair");
  const uniswapDaiWethPool = await UniswapV2Pair.attach(uniswapDaiWethPoolAddress);
  await uniswapDaiWethPool.mint(account[0]);

  await mockSushiswapV2Factory.setFeeTo(mockSushiswapV2Factory.address);
  const sushiswapDaiWethPool = await UniswapV2Pair.attach(sushiswapDaiWethPoolAddress);
  await sushiswapDaiWethPool.mint(account[0]);

  return [dai, weth, mockUniswapV2Factory, mockSushiswapV2Factory, uniswapDaiWethPoolAddress, sushiswapDaiWethPoolAddress];
}
