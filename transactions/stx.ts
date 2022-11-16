import { StacksMainnet, StacksTestnet } from '@stacks/network';
import {
  addressToString,
  AnchorMode,
  broadcastTransaction,
  bufferCVFromString,
  ChainID,
  ClarityValue,
  createStacksPrivateKey,
  estimateContractFunctionCall,
  estimateTransfer,
  hexToCV,
  makeUnsignedContractCall,
  makeUnsignedSTXTokenTransfer,
  noneCV,
  PostCondition,
  someCV,
  StacksTransaction,
  standardPrincipalCV,
  TransactionSigner,
  TxBroadcastResultOk,
  TxBroadcastResultRejected,
  uintCV,
  UnsignedContractCallOptions,
  UnsignedTokenTransferOptions,
} from '@stacks/transactions';
import{
  NetworkType,
  PostConditionsOptions,
  SettingsNetwork,
  StxMempoolTransactionData,
} from 'types';
import { getStxAddressKeyChain } from '../wallet/index';
import { getNewNonce, makeFungiblePostCondition, makeNonFungiblePostCondition } from './helper';
import { UnsignedContractCallTransaction, UnsignedStacksTransation } from '../types/api/stacks/transaction';

export async function signTransaction(
  unsignedTx: StacksTransaction,
  seedPhrase: string,
  accountIndex: number,
  network: NetworkType
): Promise<StacksTransaction> {
  const tx = unsignedTx;
  const { privateKey } = await getStxAddressKeyChain(
    seedPhrase,
    network === 'Mainnet' ? ChainID.Mainnet : ChainID.Testnet,
    accountIndex
  );
  const signer = new TransactionSigner(tx);
  const stacksPrivateKey = createStacksPrivateKey(privateKey);
  signer.signOrigin(stacksPrivateKey);

  return tx;
}

export async function broadcastSignedTransaction(
  signedTx: StacksTransaction,
  network: NetworkType
): Promise<string> {
  const addressUrl = 'https://stacks-node-api.mainnet.stacks.co';
  const txNetwork =
    network === 'Mainnet'
      ? new StacksMainnet({ url: addressUrl })
      : new StacksTestnet({ url: addressUrl });
  const result = await broadcastTransaction(signedTx, txNetwork);
  if (result.hasOwnProperty('error')) {
    const errorResult = result as TxBroadcastResultRejected;
    throw new Error(errorResult.reason);
  } else {
    const res = result as TxBroadcastResultOk;
    if (signedTx.txid() !== res.txid) {
      throw new Error('post condition error');
    }
    return res.txid;
  }
}

export async function signMultiStxTransactions(
  unsignedTxs: Array<StacksTransaction>,
  accountIndex: number,
  network: NetworkType,
  seedPhrase: string
): Promise<Array<StacksTransaction>> {
  try {
    const signedTxPromises: Array<Promise<StacksTransaction>> = [];
    const signingAccountIndex = accountIndex ?? BigInt(0);
    unsignedTxs.forEach((unsignedTx) => {
      signedTxPromises.push(signTransaction(unsignedTx, seedPhrase, signingAccountIndex, network));
    });

    return Promise.all(signedTxPromises);
  } catch (error: any) {
    return Promise.reject(error.toString());
  }
}

export function setNonce(transaction: StacksTransaction, nonce: bigint) {
  transaction.setNonce(nonce);
}

export function getNonce(transaction: StacksTransaction): bigint {
  return transaction.auth.spendingCondition?.nonce ?? BigInt(0);
}

export function setFee(transaction: StacksTransaction, fee: bigint) {
  transaction.setFee(fee);
}

/**
 * Constructs an unsigned token transfer transaction
 */
export async function generateUnsignedSTXTokenTransfer(
  publicKey: string,
  recipientAddress: string,
  amount: string,
  network: NetworkType,
  memo?: string,
  sponsored?: boolean
): Promise<StacksTransaction> {
  const amountBN = BigInt(amount);
  if (!sponsored) sponsored = false;
  const txNetwork = network === 'Mainnet' ? new StacksMainnet() : new StacksTestnet();
  const txOptions: UnsignedTokenTransferOptions = {
    publicKey: publicKey,
    recipient: recipientAddress,
    amount: amountBN,
    memo: memo ?? '',
    network: txNetwork,
    fee: 0,
    sponsored: sponsored,
    anchorMode: AnchorMode.Any,
  };

  return makeUnsignedSTXTokenTransfer(txOptions);
}

/**
 * Estimates the fee for given transaction
 * @param transaction StacksTransaction object
 */
export async function estimateFees(
  transaction: StacksTransaction,
  network: NetworkType
): Promise<bigint> {
  const txNetwork = network === 'Mainnet' ? new StacksMainnet() : new StacksTestnet();
  return estimateTransfer(transaction, txNetwork).then((fee) => {
    return BigInt(fee.toString());
  });
}

export async function generateUnsignedStxTokenTransferTransaction(
  recipientAddress: string,
  amount: string,
  memo: string,
  pendingTxs: StxMempoolTransactionData[],
  publicKey: string,
  network: NetworkType,
  sponsored?: boolean
): Promise<StacksTransaction> {
  try {
    var unsignedTx: StacksTransaction | null = null;
    var fee: bigint = BigInt(0);
    var total: bigint = BigInt(0);
    const amountBigint = BigInt(amount);
    unsignedTx = await generateUnsignedSTXTokenTransfer(
      publicKey,
      recipientAddress,
      amount,
      network,
      memo,
      sponsored
    );
    fee = await estimateFees(unsignedTx, network);

    total = amountBigint + fee;
    unsignedTx.setFee(fee);

    const nonce = getNewNonce(pendingTxs, getNonce(unsignedTx));
    setNonce(unsignedTx, nonce);
    return Promise.resolve(unsignedTx);
  } catch (err: any) {
    return Promise.reject(err.toString());
  }
}


/**
 * Constructs an unsigned smart contract call transaction
 */
 export async function generateUnsignedContractCall(
   unsignedTx: UnsignedContractCallTransaction
 ): Promise<StacksTransaction> {
   const {
     network,
     contractAddress,
     contractName,
     functionName,
     functionArgs,
     publicKey,
     postConditions = [],
     postConditionMode,
     sponsored,
     nonce,
   } = unsignedTx;
   const txNetwork = network.type === 'Mainnet' ? new StacksMainnet() : new StacksTestnet();
   const txOptions: UnsignedContractCallOptions = {
     contractAddress,
     contractName,
     functionName,
     functionArgs,
     publicKey,
     network: txNetwork,
     postConditions: postConditions,
     postConditionMode: postConditionMode ?? 1,
     anchorMode: AnchorMode.Any,
     sponsored: sponsored,
   };

   if (nonce) {
     txOptions['nonce'] = BigInt(nonce);
   }

   return makeUnsignedContractCall(txOptions);
 }

/**
 * Estimates the fee for given transaction
 * @param transaction StacksTransaction object
 */
export async function estimateContractCallFees(
  transaction: StacksTransaction,
  network: SettingsNetwork
): Promise<bigint> {
  const txNetwork = network.type === 'Mainnet' ? new StacksMainnet() : new StacksTestnet();
  return estimateContractFunctionCall(transaction, txNetwork).then((fee) => {
    return fee;
  });
}

/**
 * generate fungible token transfer or nft transfer transaction
 * @param amount
 * @param senderAddress
 * @param recipientAddress
 * @param contractAddress
 * @param contractName
 * @param publicKey
 * @param network
 * @returns
 */
export async function generateUnsignedTransaction(
  unsginedTx: UnsignedStacksTransation
): Promise<StacksTransaction> {
  var unsignedTx;
  const functionName = 'transfer';
  let functionArgs: ClarityValue[];

  const {
    contractAddress,
    contractName,
    assetName,
    senderAddress,
    amount,
    isNFT = false,
    recipientAddress,
    memo,
    publicKey,
    network,
    pendingTxs,
  } = unsginedTx;

  const postConditionOptions: PostConditionsOptions = {
    contractAddress,
    contractName,
    assetName,
    stxAddress: senderAddress,
    amount,
  };

  var postConditions: PostCondition[];
  if (isNFT) {
    postConditions = [makeNonFungiblePostCondition(postConditionOptions)];
    functionArgs = [
      hexToCV(amount),
      standardPrincipalCV(senderAddress),
      standardPrincipalCV(recipientAddress),
    ];
  } else {
    functionArgs = [
      uintCV(Number(amount)),
      standardPrincipalCV(senderAddress),
      standardPrincipalCV(recipientAddress),
    ];
    if (memo) {
      functionArgs.push(memo !== '' ? someCV(bufferCVFromString(memo)) : noneCV());
    } else {
      functionArgs.push(noneCV());
    }
    postConditions = [makeFungiblePostCondition(postConditionOptions)];
  }

  try {
    const unsignedContractCallParam: UnsignedContractCallTransaction ={
      publicKey: publicKey,
      contractAddress,
      contractName,
      functionName,
      functionArgs,
      network,
      nonce: undefined,
      postConditions: postConditions,
    }
    unsignedTx = await generateUnsignedContractCall(
      unsignedContractCallParam
    );

    const fee = await estimateContractCallFees(unsignedTx, network);
    setFee(unsignedTx, fee);

    // bump nonce by number of pending transactions
    const nonce = getNewNonce(pendingTxs, getNonce(unsignedTx));
    setNonce(unsignedTx, nonce);
    return Promise.resolve(unsignedTx);
  } catch (err: any) {
    return Promise.reject(err.toString());
  }
}



export { addressToString };
