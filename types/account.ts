export type AccountType = 'ledger' | 'software';

export interface Account {
  id: number;
  stxAddress: string;
  btcAddress: string;
  ordinalsAddress: string;
  masterPubKey: string;
  stxPublicKey: string;
  btcPublicKey: string;
  ordinalsPublicKey: string;
  bnsName?: string;
  accountType?: AccountType;
  accountName?: string;
  deviceAccountIndex?: number;
}

export type NotificationBanner = {
  id: string;
  name: string;
  url: string;
  icon: string;
  description: string;
};
