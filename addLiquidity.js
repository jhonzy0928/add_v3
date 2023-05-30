const { ethers } = require("ethers");
const { Token } = require("@uniswap/sdk-core");
const { Pool, Position, nearestUsableTick } = require("@uniswap/v3-sdk");
const {
  abi: IUniswapV3PoolABI,
} = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json");
const {
  abi: INonfungiblePositionManagerABI,
} = require("@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json");
const ERC20ABI = require("./abi.json");

require("dotenv").config();
const INFURA_URL_TESTNET = process.env.INFURA_URL_TESTNET;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;
const WALLET_SECRET = process.env.WALLET_SECRET;

const poolAddress = "0x06387b1d6f4b8b8eb669f3b1e40aa86389e08d63"; // UNI/WETH on bsc
const positionManagerAddress = "0xEfD95614bEF3FD794f09fE6a259550FCA8a6098F"; // NonfungiblePositionManager

const provider = new ethers.providers.JsonRpcProvider(INFURA_URL_TESTNET);

const name0 = "V3";
const symbol0 = "V";
const decimals0 = 18;
const address0 = "0x5685426e4f7ef5a540a387fea95c6144b34b57a2";

const name1 = "maple";
const symbol1 = "tech";
const decimals1 = 18;
const address1 = "0xe040d3c0a539406215f483ac6093f0c00957553c";

const chainId = 97; // bsc
const WethToken = new Token(chainId, address0, decimals0, symbol0, name0);
const UniToken = new Token(chainId, address1, decimals1, symbol1, name1);

const nonfungiblePositionManagerContract = new ethers.Contract(
  positionManagerAddress,
  INonfungiblePositionManagerABI,
  provider
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

  const WETH_UNI_POOL = new Pool(
    WethToken,
    UniToken,
    poolData.fee,
    poolData.sqrtPriceX96.toString(),
    poolData.liquidity.toString(),
    poolData.tick
  );

  console.log("read pool: " + WETH_UNI_POOL);

  const position = new Position({
    pool: WETH_UNI_POOL,
    liquidity: ethers.utils.parseUnits("3000", 18),
    tickLower:
      nearestUsableTick(poolData.tick, poolData.tickSpacing) -
      poolData.tickSpacing * 2,
    tickUpper:
      nearestUsableTick(poolData.tick, poolData.tickSpacing) +
      poolData.tickSpacing * 2,
  });

  const wallet = new ethers.Wallet(WALLET_SECRET);
  const connectedWallet = wallet.connect(provider);

  console.log("wallet connected");

  const approvalAmount = ethers.utils.parseUnits("5000", 18).toString();
  const tokenContract0 = new ethers.Contract(address0, ERC20ABI, provider);
  await tokenContract0
    .connect(connectedWallet)
    .approve(positionManagerAddress, approvalAmount);
  const tokenContract1 = new ethers.Contract(address1, ERC20ABI, provider);
  await tokenContract1
    .connect(connectedWallet)
    .approve(positionManagerAddress, approvalAmount);

  console.log("wallet approved");

  const { amount0: amount0Desired, amount1: amount1Desired } =
    position.mintAmounts;
  // mintAmountsWithSlippage

  params = {
    token0: address0,
    token1: address1,
    fee: poolData.fee,
    tickLower:
      nearestUsableTick(poolData.tick, poolData.tickSpacing) -
      poolData.tickSpacing * 2,
    tickUpper:
      nearestUsableTick(poolData.tick, poolData.tickSpacing) +
      poolData.tickSpacing * 2,
    amount0Desired: amount0Desired.toString(),
    amount1Desired: amount1Desired.toString(),
    amount0Min: amount0Desired.toString(),
    amount1Min: amount1Desired.toString(),
    recipient: WALLET_ADDRESS,
    deadline: Math.floor(Date.now() / 1000) + 60 * 10,
  };

  console.log("params ready");
  console.log(params);

  nonfungiblePositionManagerContract
    .connect(connectedWallet)
    .mint(params, { gasLimit: ethers.utils.hexlify(1000000) })
    .then((res) => {
      console.log(res);
    });
}

main();
