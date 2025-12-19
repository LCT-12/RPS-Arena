'use client';

import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';
import { PACKAGE_ID } from '../constants';

// The Coin Type for your module 'ggc' and witness 'GGC'
const GGC_COIN_TYPE = `${PACKAGE_ID}::ggc::GGC`;
const MIST_PER_GGC = 1_000_000_000; // 10^9 (Since you set decimals to 9 in init)

export const useGGCBalance = () => {
  const client = useSuiClient();
  const account = useCurrentAccount();

  const query = useQuery({
    // 1. Unique Query Key for GGC
    queryKey: ['ggcBalance', account?.address],

    queryFn: async () => {
      if (!account?.address) {
        return '0';
      }

      // 2. Fetch specific Coin Type
      const balanceResult = await client.getBalance({
        owner: account.address,
        coinType: GGC_COIN_TYPE,
      });

      const balanceInMist = BigInt(balanceResult.totalBalance);

      // 3. Convert to human-readable format
      const balanceInGGC = (Number(balanceInMist) / MIST_PER_GGC).toFixed(2); // Adjusted to 2 decimals for cleaner UI

      return balanceInGGC;
    },
    enabled: !!account?.address,
    // Optional: Auto-refetch every 10 seconds to keep UI fresh
    refetchInterval: 10000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
