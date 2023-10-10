import { getOEContract } from '@eth-optimism/sdk';
import { BlockExplorerTransaction } from 'apps/bridge/src/types/API';
import { Asset } from 'apps/bridge/src/types/Asset';
import { BridgeTransaction } from 'apps/bridge/src/types/BridgeTransaction';
import { getAssetListForChainEnv } from 'apps/bridge/src/utils/assets/getAssetListForChainEnv';
import { BigNumber, utils } from 'ethers';
import getConfig from 'next/config';
import TokenMessenger from 'apps/bridge/src/contract-abis/TokenMessenger';

const assetList = getAssetListForChainEnv();

const { publicRuntimeConfig } = getConfig();

const ETH_DEPOSIT_ADDRESS = (
  publicRuntimeConfig?.l1OptimismPortalProxyAddress ?? '0xe93c8cD0D409341205A592f8c4Ac1A5fe5585cfA'
).toLowerCase();

const ERC20_DEPOSIT_ADDRESS = (
  publicRuntimeConfig?.l1BridgeProxyAddress ?? '0xfA6D8Ee5BE770F84FC001D098C4bD604Fe01284a'
).toLowerCase();

const CCTP_DEPOSIT_ADDRESS = (
  publicRuntimeConfig?.l1CCTPTokenMessengerAddress ?? '0xd0c3da58f55358142b8d3e06c1c30c5c6114efe8'
).toLowerCase();

const L2_CHAIN_ID = parseInt(publicRuntimeConfig?.l2ChainID ?? '84531');

const l1StandardBridgeInterface = getOEContract('L1StandardBridge', L2_CHAIN_ID, {
  address: ERC20_DEPOSIT_ADDRESS,
}).interface;

const cctpTokenMessengerInterface = new utils.Interface(TokenMessenger);

export function explorerTxToBridgeDeposit(tx: BlockExplorerTransaction): BridgeTransaction {
  if (tx.to === ETH_DEPOSIT_ADDRESS) {
    // ETH deposit (OP)
    return {
      type: 'Deposit',
      from: tx.from,
      to: tx.to,
      assetSymbol: 'ETH',
      amount: tx.value,
      blockTimestamp: tx.timeStamp,
      hash: tx.hash as `0x${string}`,
      status: 'Complete',
      priceApiId: 'ethereum',
      assetDecimals: 18,
      protocol: 'OP',
    };
  } else if (tx.to === CCTP_DEPOSIT_ADDRESS) {
    // CCTP deposit (CCTP)
    const decodedDepositData = cctpTokenMessengerInterface.decodeFunctionData(
      tx.input.slice(0, 10),
      tx.input,
    );
    const token = assetList.find(
      (asset) =>
        asset.L1chainId === parseInt(publicRuntimeConfig.l1ChainID) &&
        asset.L1contract?.toLowerCase() === (decodedDepositData[3] as string).toLowerCase() &&
        asset.protocol === 'CCTP',
    ) as Asset;
    return {
      type: 'Deposit',
      from: tx.from,
      to: tx.to,
      assetSymbol: token.L1symbol ?? '',
      amount: (decodedDepositData[0] as BigNumber).toString(),
      blockTimestamp: tx.timeStamp,
      hash: tx.hash as `0x${string}`,
      priceApiId: token.apiId,
      assetDecimals: token.decimals,
      protocol: 'CCTP',
    };
  }

  // ERC-20 desposit (OP)
  const functionName = l1StandardBridgeInterface.getFunction(tx.input.slice(0, 10)).name;
  const decodedDepositData = l1StandardBridgeInterface.decodeFunctionData(
    tx.input.slice(0, 10),
    tx.input,
  );
  const token = assetList.find(
    (asset) =>
      asset.L1chainId === parseInt(publicRuntimeConfig.l1ChainID) &&
      asset.L1contract?.toLowerCase() === (decodedDepositData[0] as string).toLowerCase(),
  ) as Asset;
  return {
    type: 'Deposit',
    from: tx.from,
    to: tx.to,
    assetSymbol: token.L1symbol ?? '',
    amount: (
      (functionName === 'depositERC20' ? decodedDepositData[2] : decodedDepositData[3]) as BigNumber
    ).toString(),
    blockTimestamp: tx.timeStamp,
    hash: tx.hash as `0x${string}`,
    status: 'Complete',
    priceApiId: token.apiId,
    assetDecimals: token.decimals,
    protocol: 'OP',
  };
}
