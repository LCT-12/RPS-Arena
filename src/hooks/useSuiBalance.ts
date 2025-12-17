'use client';

import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';
import { MIST_PER_SUI } from '@mysten/sui/utils';

export const useSuiBalance = () => {
  const client = useSuiClient();
  const account = useCurrentAccount();

  const query = useQuery({
    queryKey: ['suiBalance', account?.address],
    queryFn: async () => {
      if (!account?.address) {
        return '0';
      }
      const balanceResult = await client.getBalance({
        owner: account.address,
      });
      const balanceInMIST = BigInt(balanceResult.totalBalance);
      const balanceInSUI = (
        Number(balanceInMIST) / Number(MIST_PER_SUI)
      ).toFixed(3);
      return balanceInSUI;
    },
    enabled: !!account?.address,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
