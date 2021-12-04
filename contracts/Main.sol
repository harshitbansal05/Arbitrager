// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './libraries/FullMath.sol';
import './libraries/Babylonian.sol';
import './libraries/UniswapV2Library.sol';
import './interfaces/IUniswapV2Pair.sol';

contract Arbitrager {

    address public exchangeAFactory;
    address public exchangeBFactory;
    address public exchangeBRouter;
    uint256 constant deadline = 10 days;

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
            Babylonian.sqrt(aToB ? reservesExchangeATokenA : reservesExchangeBTokenB) * 1000,
            Babylonian.sqrt(aToB ? reservesExchangeBTokenA : reservesExchangeATokenB),
            997
        );
        if (leftSide < rightSide) return (false, 0);
        uint256 numerator = leftSide - rightSide;
        uint256 denominator = aToB ? reservesExchangeBTokenB * 1000 + reservesExchangeATokenB * 997
                                        :
                                     reservesExchangeBTokenA * 1000 + reservesExchangeATokenA * 997;
        amountIn = FullMath.mulDiv(numerator, rightSide, denominator);
    }

    function _flashSwap(
        address tokenA,
        address tokenB,
        address to,
        bool aToB,
        uint256 amountIn,
        bytes memory data
    ) internal {
        address[] memory path = new address[](2);
        address tokenIn = aToB ? tokenA : tokenB;
        address tokenOut = aToB ? tokenB : tokenA;
        path[0] = tokenIn;
        path[1] = tokenOut;
        uint[] memory amounts = UniswapV2Library.getAmountsOut(exchangeAFactory, amountIn, path);
        (address token0,) = UniswapV2Library.sortTokens(tokenIn, tokenOut);
        uint amountOut = amounts[1];
        (uint amount0Out, uint amount1Out) = tokenIn == token0 ? (uint(0), amountOut) : (amountOut, uint(0));
        IUniswapV2Pair(UniswapV2Library.pairFor(exchangeAFactory, tokenIn, tokenOut)).swap(
            amount0Out, amount1Out, to, data
        );
    }  

    function arbitrage(
        address _exchangeAFactory,
        address _exchangeBFactory,
        address _exchangeBRouter,
        address tokenA,
        address tokenB,
        address flashLoanContractAddress
    ) external {
        exchangeAFactory = _exchangeAFactory;
        exchangeBFactory = _exchangeBFactory;
        exchangeBRouter = _exchangeBRouter;
        (uint256 reservesExchangeATokenA, uint256 reservesExchangeATokenB) = UniswapV2Library.getReserves(
            exchangeAFactory, tokenA, tokenB
        );
        (uint256 reservesExchangeBTokenA, uint256 reservesExchangeBTokenB) = UniswapV2Library.getReserves(
            exchangeBFactory, tokenA, tokenB
        );
        (bool aToB, uint256 amountIn) = computeProfitMaximizingTrade(
            reservesExchangeATokenA,
            reservesExchangeATokenB,
            reservesExchangeBTokenA,
            reservesExchangeBTokenB
        );
        bytes memory data = abi.encode(exchangeBFactory, exchangeBRouter);
        if(amountIn != 0) _flashSwap(tokenA, tokenB, flashLoanContractAddress, aToB, amountIn, data);
    }
}
