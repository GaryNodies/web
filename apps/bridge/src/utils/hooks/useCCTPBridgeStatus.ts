import { useEffect, useState } from 'react';
import { useWaitForTransaction } from 'wagmi';
import getConfig from 'next/config';
import { CCTPBridgePhase } from 'apps/bridge/src/utils/transactions/phase';
import { useQuery } from 'react-query';
import { BytesLike, utils } from 'ethers';

const { publicRuntimeConfig } = getConfig();

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
};

type CCTPBridgeStatus = {
  status: CCTPBridgePhase;
  message?: `0x${string}`;
  attestation?: `0x${string}`;
};

export function useCCTPBridgeStatus({
  initiateTxHash,
}: UseCCTPBridgeStatusProps): CCTPBridgeStatus {
  const [status, setStatus] = useState<CCTPBridgePhase>('INITIATE_CCTP_BRIDGE_PENDING');
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [messageHash, setMessageHash] = useState<string | undefined>(undefined);

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
      setMessage(messageBytes.toString());
      setMessageHash(hash);
    }
  }, [initiateTxReceipt]);

  useEffect(() => {
    if (bridgeAttestation) {
      setStatus(
        bridgeAttestation.status === 'pending_confirmations'
          ? 'INITIATE_CCTP_BRIDGE_PENDING'
          : 'FINALIZE_CCTP_BRIDGE',
      );
    }
  }, [bridgeAttestation]);

  return {
    status,
    message: message ? (message as `0x${string}`) : undefined,
    attestation: bridgeAttestation?.attestation,
  };
}
