import { getOEContract } from '@eth-optimism/sdk';
import { BlockExplorerTransaction } from 'apps/bridge/src/types/API';
import getConfig from 'next/config';
import TokenMessenger from 'apps/bridge/src/contract-abis/TokenMessenger';
import { utils } from 'ethers';

const { publicRuntimeConfig } = getConfig();

const ETH_DEPOSIT_ADDRESS = (
  publicRuntimeConfig?.l1OptimismPortalProxyAddress ?? '0xe93c8cD0D409341205A592f8c4Ac1A5fe5585cfA'
).toLowerCase();

const ERC20_DEPOSIT_ADDRESS = (
  publicRuntimeConfig?.l1BridgeProxyAddress ?? '0xfA6D8Ee5BE770F84FC001D098C4bD604Fe01284a'
).toLowerCase();

const CCTP_DEPOSIT_ADDRESS = (
  publicRuntimeConfig?.l1CCTPTokenMessengerAddress ?? '0x877b8e8c9e2383077809787ED6F279ce01CB4cc8'
).toLowerCase();

const L2_CHAIN_ID = parseInt(publicRuntimeConfig?.l2ChainID ?? '84531');

const l1StandardBridgeInterface = getOEContract('L1StandardBridge', L2_CHAIN_ID, {
  address: ERC20_DEPOSIT_ADDRESS,
}).interface;

const cctpTokenMessengerInterface = new utils.Interface(TokenMessenger);

export function isETHOrERC20Deposit(tx: BlockExplorerTransaction) {
  // Immediately filter out if tx is not to an address we don't care about
  if (
    tx.to !== ETH_DEPOSIT_ADDRESS &&
    tx.to !== ERC20_DEPOSIT_ADDRESS &&
    tx.to !== CCTP_DEPOSIT_ADDRESS
  ) {
    return false;
  }

  // ETH deposit
  if (tx.to === ETH_DEPOSIT_ADDRESS && tx.value !== '0') {
    return true;
  }

  // ERC-20 desposit
  if (tx.to === ERC20_DEPOSIT_ADDRESS) {
    const functionName = l1StandardBridgeInterface.getFunction(tx.input.slice(0, 10)).name;
    if (functionName === 'depositERC20' || functionName === 'depositERC20To') {
      return true;
    }
  }

  // CCTP deposit
  if (tx.to === CCTP_DEPOSIT_ADDRESS) {
    const functionName = cctpTokenMessengerInterface.getFunction(tx.input.slice(0, 10)).name;
    if (functionName === 'depositForBurn') {
      return true;
    }
  }

  return false;
}
