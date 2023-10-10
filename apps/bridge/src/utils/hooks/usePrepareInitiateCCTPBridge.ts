import TokenMessenger from 'apps/bridge/src/contract-abis/TokenMessenger';
import { Asset } from 'apps/bridge/src/types/Asset';
import { parseUnits, hexZeroPad, arrayify } from 'ethers/lib/utils.js';
import getConfig from 'next/config';
import { Address, usePrepareContractWrite } from 'wagmi';

const { publicRuntimeConfig } = getConfig();

const BRIDGE_DIRECTION_TO_TOKEN_MESSENGER: Record<'deposit' | 'withdraw', `0x${string}`> = {
  deposit: publicRuntimeConfig.l1CCTPTokenMessengerAddress,
  withdraw: publicRuntimeConfig.l2CCTPTokenMessengerAddress,
};

const BRIDGE_DIRECTION_TO_CHAIN_ID: Record<'deposit' | 'withdraw', number> = {
  deposit: parseInt(publicRuntimeConfig.l1ChainID),
  withdraw: parseInt(publicRuntimeConfig.l2ChainID),
};

type UsePrepareInitiateCCTPBridgeProps = {
  mintRecipient?: Address;
  asset: Asset;
  amount: string;
  destinationDomain: number;
  isPermittedToBridge: boolean;
  includeTosVersionByte: boolean;
  bridgeDirection: 'deposit' | 'withdraw';
};

export function usePrepareInitiateCCTPBridge({
  mintRecipient,
  asset,
  amount,
  destinationDomain,
  isPermittedToBridge,
  bridgeDirection,
}: UsePrepareInitiateCCTPBridgeProps) {
  const shouldPrepare = isPermittedToBridge && amount !== '' && mintRecipient;

  const { config } = usePrepareContractWrite({
    address: shouldPrepare ? BRIDGE_DIRECTION_TO_TOKEN_MESSENGER[bridgeDirection] : undefined,
    abi: TokenMessenger,
    functionName: 'depositForBurn',
    chainId: BRIDGE_DIRECTION_TO_CHAIN_ID[bridgeDirection],
    args: shouldPrepare
      ? [
          amount !== '' ? parseUnits(amount, asset.decimals) : parseUnits('0', asset.decimals),
          destinationDomain,
          hexZeroPad(arrayify(mintRecipient), 32) as `0x${string}`,
          (bridgeDirection === 'deposit' ? asset.L1contract : asset.L2contract) as Address,
        ]
      : undefined,
  });
  return config;
}
