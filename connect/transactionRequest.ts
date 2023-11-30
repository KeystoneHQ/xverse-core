import {
  TransactionPayload,
  TransactionTypes,
  ContractCallPayload,
  STXTransferPayload,
  ContractDeployPayload,
} from '@stacks/connect';
import { StacksNetwork } from '@stacks/network';
import {
  AddressHashMode,
  addressToString,
  Authorization,
  AuthType,
  cvToValue,
  MultiSigHashMode,
  PayloadType,
  PostCondition,
  serializeCV,
  serializePostCondition,
  SingleSigHashMode,
  StacksTransaction,
  VersionedSmartContractPayload,
} from '@stacks/transactions';
import { BigNumber } from 'bignumber.js';
import { createContractCallPromises, generateUnsignedStxTokenTransferTransaction } from '../transactions';
import { FeesMultipliers, StxPendingTxData } from '../types';
import { buf2hex } from '../utils/arrayBuffers';
import { STX_DECIMALS } from '../constant';

export async function getContractCallPromises(
  payload: TransactionPayload,
  stxAddress: string,
  network: StacksNetwork,
  stxPublicKey: string,
  auth?: Authorization,
) {
  const [unSignedContractCall, contractInterface, coinsMetaData, showPostConditionMessage] =
    await createContractCallPromises(payload, stxAddress, network, stxPublicKey);
  if (auth) {
    unSignedContractCall.auth = auth;
  }
  return {
    unSignedContractCall,
    contractInterface,
    coinsMetaData,
    showPostConditionMessage,
  };
}

export async function getTokenTransferRequest(
  recipient: string,
  amount: string,
  memo: string,
  stxPublicKey: string,
  feeMultipliers: FeesMultipliers,
  network: StacksNetwork,
  stxPendingTransactions?: StxPendingTxData,
  auth?: Authorization,
) {
  const unsignedSendStxTx: StacksTransaction = await generateUnsignedStxTokenTransferTransaction(
    recipient,
    amount,
    memo,
    stxPendingTransactions?.pendingTransactions ?? [],
    stxPublicKey,
    network,
  );
  // increasing the fees with multiplication factor
  const fee: bigint = BigInt(unsignedSendStxTx.auth.spendingCondition.fee.toString()) ?? BigInt(0);
  if (feeMultipliers?.stxSendTxMultiplier) {
    unsignedSendStxTx.setFee(fee * BigInt(feeMultipliers.stxSendTxMultiplier));
  }
  if (auth) {
    unsignedSendStxTx.auth = auth;
  }
  return unsignedSendStxTx;
}

export const isMultiSig = (tx: StacksTransaction): boolean => {
  const hashMode = tx.auth.spendingCondition.hashMode as MultiSigHashMode | SingleSigHashMode;
  return hashMode === AddressHashMode.SerializeP2SH || hashMode === AddressHashMode.SerializeP2WSH ? true : false;
};

const cleanMemoString = (memo: string): string => memo.replace('\u0000', '');

function encodePostConditions(postConditions: PostCondition[]) {
  return postConditions.map((pc) => buf2hex(serializePostCondition(pc)));
}

export const txPayloadToRequest = (
  stacksTransaction: StacksTransaction,
  stxAddress?: string,
  attachment?: string,
): TransactionPayload => {
  const { payload, auth, postConditions, postConditionMode, anchorMode } = stacksTransaction;
  const encodedPostConditions = encodePostConditions(postConditions.values as PostCondition[]);
  const transactionRequest = {
    attachment,
    stxAddress,
    sponsored: auth.authType === AuthType.Sponsored,
    nonce: Number(auth.spendingCondition.nonce),
    fee: Number(auth.spendingCondition.fee),
    postConditions: encodedPostConditions,
    postConditionMode: postConditionMode,
    anchorMode: anchorMode,
  } as TransactionPayload;
  switch (payload.payloadType) {
    case PayloadType.TokenTransfer:
      const memo = cleanMemoString(payload.memo.content);
      (transactionRequest as STXTransferPayload).txType = TransactionTypes.STXTransfer;
      (transactionRequest as STXTransferPayload).recipient = cvToValue(payload.recipient, true);
      (transactionRequest as STXTransferPayload).amount = new BigNumber(Number(payload.amount))
        .toNumber()
        .toLocaleString('en-US', { maximumFractionDigits: STX_DECIMALS });
      (transactionRequest as STXTransferPayload).memo = memo;
      break;
    case PayloadType.ContractCall:
      (transactionRequest as ContractCallPayload).txType = TransactionTypes.ContractCall;
      (transactionRequest as ContractCallPayload).contractName = payload.contractName.content;
      (transactionRequest as ContractCallPayload).contractAddress = addressToString(payload.contractAddress);
      (transactionRequest as ContractCallPayload).functionArgs = payload.functionArgs.map((arg) =>
        Buffer.from(serializeCV(arg)).toString('hex'),
      );
      (transactionRequest as ContractCallPayload).functionName = payload.functionName.content;
      break;
    case PayloadType.SmartContract:
    case PayloadType.VersionedSmartContract:
      (transactionRequest as ContractDeployPayload).txType = TransactionTypes.ContractDeploy;
      (transactionRequest as ContractDeployPayload).contractName = payload.contractName.content;
      (transactionRequest as ContractDeployPayload).codeBody = payload.codeBody.content;
      (transactionRequest as ContractDeployPayload ).clarityVersion = (
        payload as VersionedSmartContractPayload
      ).clarityVersion;
      break;
    default:
      throw new Error('Unsupported tx type');
  }

  return transactionRequest;
};
