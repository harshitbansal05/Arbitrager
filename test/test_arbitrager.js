require("mocha-skip-if");
const { expect } = require("chai");
const { deployMocks } = require("../scripts/helpful_scripts");

skip.if(network.name != "hardhat").
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

    expect( daiProfit > 0 || wethProfit > 0 );
  });
});
