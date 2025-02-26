import { AccountType } from './account';

export enum AnalyticsEvents {
  OptOut = 'Opt Out',
  CreateNewWallet = 'Create new wallet',
  RestoreWallet = 'Restore wallet',
  ClickApp = 'click_app',
  AppConnected = 'app_connected',
  TransactionConfirmed = 'transaction_confirmed',
  WalletMigrated = 'wallet_migrated',
  WalletSkippedMigration = 'wallet_skipped_migration',
  InitiateSwapFlow = 'initiate_swap_flow',
  FetchSwapQuote = 'fetch_swap_quote',
  SelectSwapQuote = 'select_swap_quote',
  ConfirmSwap = 'confirm_swap',
  SignSwap = 'sign_swap',
  SelectTokenToSwapFrom = 'select_token_to_swap_from',
  SelectTokenToSwapTo = 'select_token_to_swap_to',
  ListRuneInitiated = 'list_rune_initiated',
  ListRuneSigned = 'list_rune_signed',
}

type CommonProps = {
  wallet_type: AccountType;
};

type FromToAmount = { fromAmount: string; toAmount: string };

type FromToToken = { from: string; to: string; fromPrincipal?: string; toPrincipal?: string };

type QuoteSwapProps = FromToToken & {
  provider: string;
};

type QuoteSwapAmountProps = QuoteSwapProps & FromToAmount;

type SelectSwapTokenProps = {
  selectedToken: string;
  principal?: string;
};

export type AnalyticsEventProperties = {
  [AnalyticsEvents.ClickApp]: {
    link: string;
    source: string;
    title?: string;
    section?: string;
  };
  [AnalyticsEvents.AppConnected]: {
    requestedAddress: string[];
  } & CommonProps;
  [AnalyticsEvents.TransactionConfirmed]: {
    protocol: 'brc20' | 'sip10' | 'bitcoin' | 'stacks' | 'runes' | 'ordinals' | 'rare-sats' | 'stacks-nfts';
    action: 'inscribe' | 'transfer' | 'sign-message' | 'sign-psbt' | 'sign-batch-psbt';
    repeat?: number;
    batch?: number;
  } & CommonProps;
  [AnalyticsEvents.InitiateSwapFlow]: {
    selectedToken?: string;
    principal?: string;
  };
  [AnalyticsEvents.FetchSwapQuote]: FromToToken & FromToAmount;
  [AnalyticsEvents.SelectSwapQuote]: QuoteSwapProps;
  [AnalyticsEvents.ConfirmSwap]: QuoteSwapAmountProps;
  [AnalyticsEvents.SignSwap]: QuoteSwapAmountProps;
  [AnalyticsEvents.SelectTokenToSwapFrom]: SelectSwapTokenProps;
  [AnalyticsEvents.SelectTokenToSwapTo]: SelectSwapTokenProps;
};
