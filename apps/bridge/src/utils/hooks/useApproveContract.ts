import { utils } from 'ethers';
import getConfig from 'next/config';
import { Address, erc20ABI, usePrepareContractWrite } from 'wagmi';

const { publicRuntimeConfig } = getConfig();

type UseApproveContractProps = {
  contractAddress?: Address;
  spender: Address;
  approveAmount: string;
  decimals: number;
  bridgeDirection: 'deposit' | 'withdraw';
};

export function useApproveContract({
  contractAddress,
  spender,
  approveAmount,
  decimals,
  bridgeDirection,
}: UseApproveContractProps) {
  const approveAmountBN =
    approveAmount === '' || Number.isNaN(Number(approveAmount))
      ? utils.parseUnits('0', decimals)
      : utils.parseUnits(approveAmount, decimals);
  const { config: depositConfig } = usePrepareContractWrite({
    address: contractAddress,
    abi: erc20ABI,
    functionName: 'approve',
    chainId:
      bridgeDirection === 'deposit'
        ? parseInt(publicRuntimeConfig.l1ChainID)
        : parseInt(publicRuntimeConfig.l2ChainID),
    args: [spender, approveAmountBN],
    cacheTime: 0,
  });
  return depositConfig;
}
