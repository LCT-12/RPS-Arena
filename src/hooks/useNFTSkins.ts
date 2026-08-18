import { useCurrentAccount } from '@mysten/dapp-kit';
import { useState, useEffect } from 'react';

export interface NFTItem {
  id: string;
  name: string;
  description: string;
  image_url: string;
  type: 'rock' | 'paper' | 'scissors';
}

export interface SelectedSkins {
  rock: NFTItem | null;
  paper: NFTItem | null;
  scissors: NFTItem | null;
}

const BASE_STORAGE_KEY = 'rps_selected_skins';

export function useNFTSkins() {
  const account = useCurrentAccount();

  // Default state is empty
  const [selectedSkins, setSelectedSkins] = useState<SelectedSkins>({
    rock: null,
    paper: null,
    scissors: null,
  });

  // 1. LOAD: When account changes, try to load that specific account's preferences
  useEffect(() => {
    if (!account?.address) {
      // If disconnected, reset to defaults so we don't show the previous user's skins
      setSelectedSkins({ rock: null, paper: null, scissors: null });
      return;
    }

    const key = `${BASE_STORAGE_KEY}_${account.address}`;
    const saved = localStorage.getItem(key);

    if (saved) {
      try {
        setSelectedSkins(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse skins', e);
        // Fallback to empty if parse fails
        setSelectedSkins({ rock: null, paper: null, scissors: null });
      }
    } else {
      // New user or no saved skins -> Reset to empty
      setSelectedSkins({ rock: null, paper: null, scissors: null });
    }
  }, [account?.address]);

  useEffect(() => {
    if (!account?.address) return;

    const key = `${BASE_STORAGE_KEY}_${account.address}`;
    localStorage.setItem(key, JSON.stringify(selectedSkins));
  }, [selectedSkins, account?.address]);

  const selectSkin = (nft: NFTItem) => {
    setSelectedSkins((prev) => ({
      ...prev,
      [nft.type]: nft,
    }));
  };

  const removeSkin = (choice: 'rock' | 'paper' | 'scissors') => {
    setSelectedSkins((prev) => ({
      ...prev,
      [choice]: null,
    }));
  };

  const getSkinForChoice = (choice: string | null) => {
    if (!choice) return null;
    const key = choice.toLowerCase();
    if (key === 'rock' || key === 'paper' || key === 'scissors') {
      return selectedSkins[key as keyof SelectedSkins];
    }
    return null;
  };

  return {
    selectedSkins,
    selectSkin,
    removeSkin,
    getSkinForChoice,
  };
}
