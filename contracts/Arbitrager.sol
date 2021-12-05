// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import 'hardhat/console.sol';
import './libraries/FullMath.sol';
import './libraries/Babylonian.sol';
import './libraries/UniswapV2Library.sol';
import './interfaces/IUniswapV2Pair.sol';

contract Arbitrager {

    address public exchangeAFactory;
    address public exchangeBFactory;
    address public poolAddressA;
    address public poolAddressB;
    
    receive() external payable {}

    event ProfitMaximizingTrade(bool aToB, uint256 amountIn );

    function computeProfitMaximizingTrade(
        uint256 reservesExchangeATokenA,
        uint256 reservesExchangeATokenB,
        uint256 reservesExchangeBTokenA,
        uint256 reservesExchangeBTokenB
    ) pure internal returns (bool aToB, uint256 amountIn) {
        aToB = FullMath.mulDiv(
            reservesExchangeATokenA,
            reservesExchangeBTokenB,
            reservesExchangeATokenB
            ) < reservesExchangeBTokenA;
        (uint256 leftSide,) = FullMath.fullMul(
            Babylonian.sqrt(aToB ? reservesExchangeBTokenA : reservesExchangeATokenA),
            Babylonian.sqrt(aToB ? reservesExchangeATokenB : reservesExchangeBTokenB)
        );
        uint256 rightSide = FullMath.mulDiv(
            Babylonian.sqrt(aToB ? reservesExchangeATokenA : reservesExchangeATokenB) * 1000,
            Babylonian.sqrt(aToB ? reservesExchangeBTokenB : reservesExchangeBTokenA),
            997
        );
        if (leftSide < rightSide) return (false, 0);
        uint256 numerator = leftSide - rightSide;
        uint256 denominator = aToB ? reservesExchangeBTokenB * 1000 + reservesExchangeATokenB * 997
                                        :
                                     reservesExchangeBTokenA * 1000 + reservesExchangeATokenA * 997;
        (uint256 mulFactor,) = FullMath.fullMul(
            Babylonian.sqrt(aToB ? reservesExchangeATokenA : reservesExchangeATokenB) * 1000,
            Babylonian.sqrt(aToB ? reservesExchangeBTokenB : reservesExchangeBTokenA)
        );
        amountIn = FullMath.mulDiv(numerator, mulFactor, denominator);
    }

    function _flashSwap(
        address tokenA,
        address tokenB,
        address to,
        bool aToB,
        uint256 amountIn,
        bytes memory data,
        bool isPoolAddress
    ) internal {
        address[] memory path = new address[](2);
        {   // scope for token{0,1}, avoids stack too deep errors
            address tokenIn = aToB ? tokenA : tokenB;
            address tokenOut = aToB ? tokenB : tokenA;
            path[0] = tokenIn;
            path[1] = tokenOut;
        }
        uint[] memory amounts = UniswapV2Library.getAmountsOut(exchangeAFactory, amountIn, path, isPoolAddress, poolAddressA);
        (address token0,) = UniswapV2Library.sortTokens(path[0], path[1]);
        uint amountOut = amounts[1];
        (uint amount0Out, uint amount1Out) = path[0] == token0 ? (uint(0), amountOut) : (amountOut, uint(0));
        IUniswapV2Pair(
            isPoolAddress ? poolAddressA :
            UniswapV2Library.pairFor(exchangeAFactory, path[0], path[1])
        ).swap(
            amount0Out, amount1Out, to, data
        );
    }  

    function arbitrage(
        address _exchangeAFactory,
        address _exchangeBFactory,
        address _poolAddressA,
        address _poolAddressB,
        address tokenA,
        address tokenB,
        address flashLoanContractAddress,
        bool isPoolAddress
    ) external {
        exchangeAFactory = _exchangeAFactory;
        exchangeBFactory = _exchangeBFactory;
        poolAddressA = _poolAddressA;
        poolAddressB = _poolAddressB;
        bool aToB;
        uint256 amountIn;
        {
            (uint256 reservesExchangeATokenA, uint256 reservesExchangeATokenB) = UniswapV2Library.getReserves(
                exchangeAFactory, tokenA, tokenB, isPoolAddress, poolAddressA
            );
            (uint256 reservesExchangeBTokenA, uint256 reservesExchangeBTokenB) = UniswapV2Library.getReserves(
                exchangeBFactory, tokenA, tokenB, isPoolAddress, poolAddressB
            );

            // Computes the direction and amount of tokens for maximizing profit
            (aToB, amountIn) = computeProfitMaximizingTrade(
                reservesExchangeATokenA,
                reservesExchangeATokenB,
                reservesExchangeBTokenA,
                reservesExchangeBTokenB
            );

            // Log variables to console for debugging
            console.log("Reserves Exchange A => Token A:", reservesExchangeATokenA);
            console.log("Reserves Exchange A => Token B:", reservesExchangeATokenB);
            console.log("Reserves Exchange B => Token A:", reservesExchangeBTokenA);
            console.log("Reserves Exchange B => Token B:", reservesExchangeBTokenB);
            console.log("Exchange A Swap Direction:", aToB ? "Token A to Token B" : "Token B to Token A");
            console.log("Exchange B Swap Direction:", aToB ? "Token B to Token A" : "Token A to Token B");
            console.log("Tokens to be swapped at Exchange A for maximum profit:", amountIn);
        }
        // Emit event
        emit ProfitMaximizingTrade(aToB, amountIn);
        bytes memory data = abi.encode(exchangeAFactory, exchangeBFactory, poolAddressA, poolAddressB);
        if(amountIn != 0) _flashSwap(tokenA, tokenB, flashLoanContractAddress, aToB, amountIn, data, isPoolAddress);
    }
}
