import { getOEContract } from '@eth-optimism/sdk';
import TokenMessenger from 'apps/bridge/src/contract-abis/TokenMessenger';
import { BlockExplorerTransaction } from 'apps/bridge/src/types/API';
import { Asset } from 'apps/bridge/src/types/Asset';
import { BridgeTransaction } from 'apps/bridge/src/types/BridgeTransaction';
import { getAssetListForChainEnv } from 'apps/bridge/src/utils/assets/getAssetListForChainEnv';
import { BigNumber, utils } from 'ethers';
import getConfig from 'next/config';

const assetList = getAssetListForChainEnv();

const { publicRuntimeConfig } = getConfig();

const ETH_WITHDRAWAL_ADDRESS = (
  publicRuntimeConfig?.l2L1MessagePasserAddress ?? '0x4200000000000000000000000000000000000016'
).toLowerCase();

const ERC20_WITHDRAWAL_ADDRESS = (
  publicRuntimeConfig?.L2StandardBridge ?? '0x4200000000000000000000000000000000000010'
).toLowerCase();

const CCTP_WITHDRAWAL_ADDRESS = (
  publicRuntimeConfig?.l2CCTPTokenMessengerAddress ?? '0x877b8e8c9e2383077809787ED6F279ce01CB4cc8'
).toLowerCase();

const L2_CHAIN_ID = parseInt(publicRuntimeConfig?.l2ChainID ?? '84531');

const l2StandardBridgeInterface = getOEContract('L2StandardBridge', L2_CHAIN_ID, {
  address: ERC20_WITHDRAWAL_ADDRESS,
}).interface;

const cctpTokenMessengerInterface = new utils.Interface(TokenMessenger);

export function explorerTxToBridgeWithdrawal(tx: BlockExplorerTransaction): BridgeTransaction {
  if (tx.to === ETH_WITHDRAWAL_ADDRESS) {
    // ETH withdrawal (OP)
    return {
      type: 'Withdrawal',
      from: tx.from,
      to: tx.to,
      assetSymbol: 'ETH',
      amount: tx.value,
      blockTimestamp: tx.timeStamp,
      hash: tx.hash as `0x${string}`,
      priceApiId: 'ethereum',
      protocol: 'OP',
    };
  } else if (tx.to === CCTP_WITHDRAWAL_ADDRESS) {
    // CCTP withdrawal (CCTP)
    const decodedWithdrawData = cctpTokenMessengerInterface.decodeFunctionData(
      tx.input.slice(0, 10),
      tx.input,
    );
    const token = assetList.find(
      (asset) =>
        asset.L1chainId === parseInt(publicRuntimeConfig.l1ChainID) &&
        asset.L2contract?.toLowerCase() === (decodedWithdrawData[3] as string).toLowerCase() &&
        asset.protocol === 'CCTP',
    ) as Asset;
    return {
      type: 'Withdrawal',
      from: tx.from,
      to: tx.to,
      assetSymbol: token.L2symbol ?? '',
      amount: (decodedWithdrawData[0] as BigNumber).toString(),
      blockTimestamp: tx.timeStamp,
      hash: tx.hash as `0x${string}`,
      priceApiId: token.apiId,
      assetDecimals: token.decimals,
      protocol: 'CCTP',
    };
  }

  // ERC-20 Withdrawal (OP)
  const functionName = l2StandardBridgeInterface.getFunction(tx.input.slice(0, 10)).name;
  const decodedWithdrawData = l2StandardBridgeInterface.decodeFunctionData(
    tx.input.slice(0, 10),
    tx.input,
  );
  const token = assetList.find(
    (asset) =>
      asset.L2chainId === parseInt(publicRuntimeConfig.l2ChainID) &&
      asset.L2contract === decodedWithdrawData[0],
  ) as Asset;
  return {
    type: 'Withdrawal',
    from: tx.from,
    to: tx.to,
    assetSymbol: token?.L2symbol ?? 'Unlisted',
    amount: (
      (functionName === 'withdraw' ? decodedWithdrawData[1] : decodedWithdrawData[2]) as BigNumber
    ).toString(),
    blockTimestamp: tx.timeStamp,
    hash: tx.hash as `0x${string}`,
    priceApiId: token?.apiId,
    protocol: 'OP',
  };
}
