const { expect } = require("chai");
const { ethers } = require("hardhat");

async function deploy_mocks() {
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

describe("Arbitrager", function () {
  it("Should arbitrage once it sees the price difference!", async function () {

    const Arbitrager = await hre.ethers.getContractFactory("Arbitrager");
    const arbitrager = await Arbitrager.deploy();
    await arbitrager.deployed();

    const FlashSwap = await hre.ethers.getContractFactory("FlashSwap");
    const flashSwap = await FlashSwap.deploy();
    await flashSwap.deployed();

    [
      dai, 
      weth, 
      mockUniswapV2Factory, 
      mockSushiswapV2Factory, 
      uniswapDaiWethPoolAddress, 
      sushiswapDaiWethPoolAddress
    ] = await deploy_mocks();

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

    expect( daiProfit > 0 || wethProfit > 0 );
  });
});
