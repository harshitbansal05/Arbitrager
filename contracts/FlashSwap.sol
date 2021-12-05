// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import 'hardhat/console.sol';
import './libraries/TransferHelper.sol';
import './libraries/UniswapV2Library.sol';
import './interfaces/IUniswapV2Callee.sol';
import './interfaces/IUniswapV2Pair.sol';
import './interfaces/IUniswapV2Router02.sol';
import './interfaces/IERC20.sol';

contract FlashSwap is IUniswapV2Callee {
    address factoryAddressA;
    address factoryAddressB;
    address poolAddressA;
    address poolAddressB;

    receive() external payable {}

    constructor() {}

    function uniswapV2Call(address sender, uint amount0, uint amount1, bytes calldata data) external override {
        address[] memory path = new address[](2);
        (
            factoryAddressA, 
            factoryAddressB, 
            poolAddressA, 
            poolAddressB
        ) = abi.decode(data, (address, address, address, address)); 
        uint amountIn;
        address token0;
        address token1;
        IERC20 token;
        {   // scope for token{0,1}, avoids stack too deep errors
            token0 = IUniswapV2Pair(msg.sender).token0();
            token1 = IUniswapV2Pair(msg.sender).token1();
            require(amount0 == 0 || amount1 == 0); // this strategy is unidirectional
            path[0] = amount0 == 0 ? token1 : token0;
            path[1] = amount0 == 0 ? token0 : token1;
            amountIn = amount0 + amount1;
            token = amount0 == 0 ? IERC20(token0) : IERC20(token1);
        }
        IERC20(path[0]).transfer(poolAddressB, amountIn);
        uint amountReceived;
        uint amountRequired;
        {
            uint[] memory amounts = UniswapV2Library.getAmountsOut(factoryAddressB, amountIn, path, true, poolAddressB);
            // Log variables to console for debugging
            console.log("Tokens received from Exchange A after swapping:", amountIn);
            console.log("Tokens to be swapped at Exchange B:", amountIn);
            console.log("Tokens received from Exchange B after swapping:", amounts[1]);
            uint amountOut = amounts[1];
            (uint amount0Out, uint amount1Out) = path[0] == token0 ? (uint(0), amountOut) : (amountOut, uint(0));
            IUniswapV2Pair(poolAddressB).swap(
                amount0Out, amount1Out, address(this), new bytes(0)
            );
            amountReceived = amountOut;
            address[] memory pathReverse = new address[](2);
            pathReverse[0] = path[1];
            pathReverse[1] = path[0];
            amountRequired = UniswapV2Library.getAmountsIn(factoryAddressA, amountIn, pathReverse, true, poolAddressA)[0];
        }
        require(amountReceived > amountRequired);
        require(token.transfer(msg.sender, amountRequired));
        require(token.transfer(sender, amountReceived - amountRequired));
    }
}
