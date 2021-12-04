// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './libraries/TransferHelper.sol';
import './libraries/UniswapV2Library.sol';
import './interfaces/IUniswapV2Callee.sol';
import './interfaces/IUniswapV2Pair.sol';
import './interfaces/IUniswapV2Router02.sol';
import './interfaces/IERC20.sol';

contract FlashSwap is IUniswapV2Callee {
    address factory;
    address exchange;
    uint256 constant deadline = 10 days;

    receive() external payable {}

    function uniswapV2Call(address sender, uint amount0, uint amount1, bytes calldata data) external override {
        address[] memory path = new address[](2);
        (factory, exchange) = abi.decode(data, (address, address)); 
        uint amountIn;
        IERC20 token;
        {   // scope for token{0,1}, avoids stack too deep errors
            address token0 = IUniswapV2Pair(msg.sender).token0();
            address token1 = IUniswapV2Pair(msg.sender).token1();
            assert(msg.sender == UniswapV2Library.pairFor(factory, token0, token1)); // ensure that msg.sender is actually a V2 pair
            assert(amount0 == 0 || amount1 == 0); // this strategy is unidirectional
            path[0] = amount0 == 0 ? token1 : token0;
            path[1] = amount0 == 0 ? token0 : token1;
            amountIn = amount0 + amount1;
            token = amount0 == 0 ? IERC20(token0) : IERC20(token1);
        }
        TransferHelper.safeApprove(path[0], address(exchange), amountIn);
        uint[] memory amounts = IUniswapV2Router02(exchange).swapExactTokensForTokens(
            amountIn,
            0,
            path,
            address(this),
            deadline
        );
        uint256 amountReceived = amounts[1];
        uint256 amountRequired = UniswapV2Library.getAmountsOut(factory, amountIn, path)[1];
        assert(amountReceived > amountRequired);
        assert(token.transfer(msg.sender, amountRequired));
        assert(token.transfer(sender, amountReceived - amountRequired));
    }
}
