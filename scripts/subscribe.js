const { ethers } = require("ethers");
const provider = new ethers.providers.JsonRpcProvider("http://0.0.0.0:8545");

// https://info.uniswap.org/pair/0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc
const uniswapUsdtWethExchange = "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc";

// this ABI object works for both Uniswap and SushiSwap
const uniswapAbi = [
  "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)",
];

const uniswapContract = new ethers.Contract(
    uniswapUsdtWethExchange,
    uniswapAbi,
    provider
  );
const filter = uniswapContract.filters.Swap();
  
uniswapContract.on(filter, (from, a0in, a0out, a1in, a1out, to, event) => {
  // TODO: Subscribe to swap events to automate arbitrage
});
