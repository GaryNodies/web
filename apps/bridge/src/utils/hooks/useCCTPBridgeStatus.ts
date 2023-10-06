import { useCallback, useEffect, useState } from 'react';
import { useProvider, useWaitForTransaction } from 'wagmi';
import getConfig from 'next/config';
import { CCTPBridgePhase } from 'apps/bridge/src/utils/transactions/phase';
import { useQuery } from 'react-query';
import { BytesLike, utils, Contract } from 'ethers';
import MessageTransmitter from 'apps/bridge/src/contract-abis/MessageTransmitter';

const { publicRuntimeConfig } = getConfig();
const l1ChainID = parseInt(publicRuntimeConfig.l1ChainID);
const l2ChainID = parseInt(publicRuntimeConfig.l2ChainID);

type BridgeAttestation = {
  attestation: `0x${string}`;
  status: string;
};

async function fetchBridgeAttestation(messageHash: string): Promise<BridgeAttestation | undefined> {
  const response = await fetch(
    `${publicRuntimeConfig.cctpAttestationsAPIURL}/attestations/${messageHash}`,
  );

  return (await response.json()) as BridgeAttestation;
}

type UseCCTPBridgeStatusProps = {
  initiateTxHash: `0x${string}`;
  bridgeDirection: 'deposit' | 'withdraw';
};

type CCTPBridgeStatus = {
  status: CCTPBridgePhase;
  message?: `0x${string}`;
  attestation?: `0x${string}`;
  setStatus: (newStatus: CCTPBridgePhase) => void;
};

export function useCCTPBridgeStatus({
  initiateTxHash,
  bridgeDirection,
}: UseCCTPBridgeStatusProps): CCTPBridgeStatus {
  const [status, setStatus] = useState<CCTPBridgePhase>('INITIATE_CCTP_BRIDGE_PENDING');
  const [message, setMessage] = useState<`0x${string}` | undefined>(undefined);
  const [messageHash, setMessageHash] = useState<`0x${string}` | undefined>(undefined);
  const provider = useProvider({ chainId: bridgeDirection === 'deposit' ? l2ChainID : l1ChainID });

  const { data: initiateTxReceipt } = useWaitForTransaction({
    hash: initiateTxHash,
    chainId: parseInt(publicRuntimeConfig.l1ChainID),
  });

  const { data: bridgeAttestation } = useQuery(
    ['bridgeAttestation', { initiateTxHash, messageHash }],
    async () => fetchBridgeAttestation(messageHash as string),
    {
      enabled: !!messageHash,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      placeholderData: undefined,
    },
  );

  useEffect(() => {
    if (initiateTxReceipt) {
      if (initiateTxReceipt.status === 0) {
        setStatus('INITIATE_CCTP_BRIDGE_FAILED');
        return;
      }

      const eventTopic = utils.keccak256(utils.toUtf8Bytes('MessageSent(bytes)'));
      const log = initiateTxReceipt.logs.find((l) => l.topics[0] === eventTopic);
      const messageBytes = utils.defaultAbiCoder.decode(
        ['bytes'],
        log?.data as string,
      )[0] as BytesLike;
      const hash = utils.keccak256(messageBytes);
      setMessage(messageBytes.toString() as `0x${string}`);
      setMessageHash(hash as `0x${string}`);
    }
  }, [initiateTxReceipt]);

  useEffect(() => {
    if (bridgeAttestation && message) {
      void (async () => {
        if (bridgeAttestation.status === 'pending_confirmations') {
          setStatus('INITIATE_CCTP_BRIDGE_PENDING');
          return;
        }

        // We still need to check whether or not the message was received on the other chain.
        // If it hasn't been received yet, the user needs to call receiveMessage on the MessageTransmitter.
        // It it has been received, the bridge is complete.
        // We can check if the message has been received by simulating a call to receiveMessage.
        // If it fails, assume it's because the message has already been received.
        const messageTransmitter = new Contract(
          publicRuntimeConfig.l2CCTPMessageTransmitterAddress,
          MessageTransmitter,
          provider,
        );

        try {
          await messageTransmitter.callStatic.receiveMessage(
            message,
            bridgeAttestation.attestation,
          );
          // Success, ie the message still needs to be received.
          setStatus('FINALIZE_CCTP_BRIDGE');
        } catch (e) {
          // Failed, ie the message has already been received.
          setStatus('CCTP_BRIDGE_COMPLETE');
        }
      })();
    }
  }, [bridgeAttestation, message, provider]);

  // We need to be able to set the status from the FinzliaeCCTPBridgeButton, so we expose a setter.
  const handleSetStatus = useCallback(
    (newStatus: CCTPBridgePhase) => {
      setStatus(newStatus);
    },
    [setStatus],
  );

  return {
    status,
    message,
    attestation: bridgeAttestation?.attestation,
    setStatus: handleSetStatus,
  };
}
