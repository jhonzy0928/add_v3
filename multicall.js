const { ethers } = require("ethers");
const {
  abi: IUniswapV3PoolABI,
} = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json");
const {
  abi: V3SwapRouterABI,
} = require("@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json");
const {
  abi: PeripheryPaymentsABI,
} = require("@uniswap/v3-periphery/artifacts/contracts/interfaces/IPeripheryPayments.sol/IPeripheryPayments.json");
const {
  abi: MulticallABI,
} = require("@uniswap/v3-periphery/artifacts/contracts/interfaces/IMulticall.sol/IMulticall.json");

require("dotenv").config();
const INFURA_URL_TESTNET = process.env.INFURA_URL_TESTNET;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;
const WALLET_SECRET = process.env.WALLET_SECRET;

const poolAddress = "0x06387b1d6f4b8b8eb669f3b1e40aa86389e08d63"; // UNI/WETH on bsc
const V3SwapRouterAddress = "0xea351C9FeA593B01A1DDe200D47f67bF0E8dDF96";
//const WETHAddress = "0xD95c3f99aC85557fE2e17b5c7DF45bA49bE12668";
const USDCAddress = "0x5685426e4f7ef5a540a387fea95c6144b34b57a2";
const UNIADDRESS = "0xe040d3c0a539406215f483ac6093f0c00957553c";

const provider = new ethers.providers.JsonRpcProvider(INFURA_URL_TESTNET);
const wallet = new ethers.Wallet(WALLET_SECRET);
const Signer2 = wallet.connect(provider);

const swapRouterContract = new ethers.Contract(
  V3SwapRouterAddress,
  V3SwapRouterABI.concat(PeripheryPaymentsABI).concat(MulticallABI)
);

const poolContract = new ethers.Contract(
  poolAddress,
  IUniswapV3PoolABI,
  provider
);

async function getPoolData(poolContract) {
  const [tickSpacing, fee, liquidity, slot0] = await Promise.all([
    poolContract.tickSpacing(),
    poolContract.fee(),
    poolContract.liquidity(),
    poolContract.slot0(),
  ]);

  return {
    tickSpacing: tickSpacing,
    fee: fee,
    liquidity: liquidity,
    sqrtPriceX96: slot0[0],
    tick: slot0[1],
  };
}

async function main() {
  const poolData = await getPoolData(poolContract);

  const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
  const params1 = {
    tokenIn: USDCAddress,
    tokenOut: UNIADDRESS,
    fee: 500,
    recipient: WALLET_ADDRESS,
    deadline: deadline,
    amountIn: ethers.utils.parseEther("1000"),
    amountOutMinimum: 0,
    sqrtPriceLimitX96: poolData.sqrtPriceX96.toString(),
  };

  console.log("pool ready" + poolData.sqrtPriceX96.toString());

  const encData1 = swapRouterContract.interface.encodeFunctionData(
    "exactInputSingle",
    [params1]
  );
  const params2 = {
    tokenIn: USDCAddress,
    tokenOut: UNIADDRESS,
    fee: 500,
    recipient: WALLET_ADDRESS,
    deadline: deadline,
    amountIn: ethers.utils.parseEther("1000"),
    amountOutMinimum: 0,
    sqrtPriceLimitX96: poolData.sqrtPriceX96.toString(),
  };
  const encData2 = swapRouterContract.interface.encodeFunctionData(
    "exactInputSingle",
    [params2]
  );

  console.log("params ready" + params2);

  const calls = [encData1, encData2];
  const encMulticall = swapRouterContract.interface.encodeFunctionData(
    "multicall",
    [calls]
  );

  console.log("multical ready");

  const txArgs = {
    to: V3SwapRouterAddress,
    from: WALLET_ADDRESS,
    data: encMulticall,
    gasLimit: 500000,
  };
  const tx = await Signer2.sendTransaction(txArgs);
  const recipient = await tx.wait();
}
main();
