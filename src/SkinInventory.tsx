import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { Package, Shield, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GG_NFT_MODULE } from './constants';
import MintSkinForm from './MintSkinForm';

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

interface NFTInventoryProps {
  selectedSkins: SelectedSkins;
  onSelectSkin: (nft: NFTItem) => void;
  onRemoveSkin: (choice: 'rock' | 'paper' | 'scissors') => void;
}

const CHOICE_CONFIG = {
  rock: {
    label: 'Rock',
    icon: '👊',
    // Rose/Red Theme
    borderColor: 'border-rose-500',
    shadowColor: 'shadow-rose-500/20',
    gradient: 'from-rose-500/10 to-transparent',
    textColor: 'text-rose-400',
    bgIcon: 'bg-rose-500/20',
  },
  paper: {
    label: 'Paper',
    icon: '✋',
    // Emerald/Green Theme
    borderColor: 'border-emerald-500',
    shadowColor: 'shadow-emerald-500/20',
    gradient: 'from-emerald-500/10 to-transparent',
    textColor: 'text-emerald-400',
    bgIcon: 'bg-emerald-500/20',
  },
  scissors: {
    label: 'Scissors',
    icon: '✌️',
    // Sky/Blue Theme
    borderColor: 'border-sky-500',
    shadowColor: 'shadow-sky-500/20',
    gradient: 'from-sky-500/10 to-transparent',
    textColor: 'text-sky-400',
    bgIcon: 'bg-sky-500/20',
  },
};

export default function SkinInventory({
  selectedSkins,
  onSelectSkin,
  onRemoveSkin,
}: NFTInventoryProps) {
  const account = useCurrentAccount();
  const client = useSuiClient();

  const [nftInventory, setNftInventory] = useState<NFTItem[]>([]);
  const [isLoadingNFTs, setIsLoadingNFTs] = useState(false);
  const [filter, setFilter] = useState<'all' | 'rock' | 'paper' | 'scissors'>(
    'all'
  );

  useEffect(() => {
    if (account) fetchUserNFTs();
  }, [account]);

  async function fetchUserNFTs() {
    if (!account?.address) return;
    setIsLoadingNFTs(true);
    try {
      const objects = await client.getOwnedObjects({
        owner: account.address,
        options: { showContent: true, showType: true },
      });

      const NFT_TYPE = `${GG_NFT_MODULE}::NFT`;
      const nfts: NFTItem[] = [];

      for (const obj of objects.data) {
        if (
          obj.data?.content?.dataType === 'moveObject' &&
          obj.data.type === NFT_TYPE
        ) {
          const fields = obj.data.content.fields as any;
          const rawGesture =
            typeof fields.gesture === 'string'
              ? fields.gesture
              : fields.gesture?.bytes ?? '';
          const gestureLower = rawGesture.toString().toLowerCase();

          // Fallback logic for type
          let type: 'rock' | 'paper' | 'scissors' | null = null;
          if (gestureLower.includes('rock') || gestureLower === 'búa')
            type = 'rock';
          else if (gestureLower.includes('paper') || gestureLower === 'bao')
            type = 'paper';
          else if (gestureLower.includes('scissors') || gestureLower === 'kéo')
            type = 'scissors';

          // Helper to clean fields
          const name =
            typeof fields.name === 'string'
              ? fields.name
              : fields.name?.bytes ?? 'Unnamed';
          const imageUrl =
            typeof fields.image_url === 'string'
              ? fields.image_url
              : fields.image_url?.url || '';

          if (type && imageUrl) {
            nfts.push({
              id: obj.data.objectId,
              name,
              description: '',
              image_url: imageUrl,
              type,
            });
          }
        }
      }
      setNftInventory(nfts);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load NFTs');
    } finally {
      setIsLoadingNFTs(false);
    }
  }

  // Filter Logic
  const filteredNFTs =
    filter === 'all'
      ? nftInventory
      : nftInventory.filter((nft) => nft.type === filter);

  if (!account)
    return (
      <div className="p-12 text-white text-center">
        Please connect your wallet.
      </div>
    );

  return (
    <div className="space-y-12 mx-auto pb-20 max-w-6xl">
      <div className="gap-8 grid grid-cols-1 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-4">
          <div className="top-6 sticky bg-gray-900/60 backdrop-blur-xl p-6 border border-white/10 rounded-3xl">
            <h3 className="flex items-center gap-2 mb-6 font-bold text-white text-xl">
              <Shield className="w-5 h-5 text-amber-400" />
              Active Loadout
            </h3>

            <div className="flex flex-col gap-5">
              {(['rock', 'paper', 'scissors'] as const).map((type) => {
                const skin = selectedSkins[type];
                const config = CHOICE_CONFIG[type];

                return (
                  <div key={type} className="group relative">
                    {/* Background Label (Behind the card) */}
                    <div
                      className={`absolute -top-3 left-4 px-2 py-0.5 bg-gray-900 border border-white/10 rounded-md text-[10px] font-black uppercase tracking-widest ${config.textColor} z-20`}
                    >
                      {config.label}
                    </div>

                    {skin ? (
                      // === 2. FILLED STATE CARD ===
                      <div
                        className={`
                        relative overflow-hidden rounded-2xl border-2 transition-all duration-300
                        bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900
                        ${config.borderColor} ${config.shadowColor} shadow-lg hover:shadow-xl hover:scale-[1.02]
                      `}
                      >
                        {/* Ambient Gradient */}
                        <div
                          className={`absolute inset-0 bg-gradient-to-r ${config.gradient} opacity-20 pointer-events-none`}
                        />

                        <div className="z-10 relative flex items-center gap-4 p-3">
                          {/* Image with Glow */}
                          <div className="relative">
                            <div
                              className={`absolute inset-0 blur-lg rounded-full opacity-50 ${config.bgIcon}`}
                            />
                            <img
                              src={skin.image_url}
                              alt={skin.name}
                              className={`w-16 h-16 rounded-xl object-cover border border-white/20 relative z-10`}
                            />
                          </div>

                          {/* Text Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span
                                className={`text-xs font-bold ${config.textColor} bg-white/5 px-1.5 rounded`}
                              >
                                {config.icon} LVL 1
                              </span>
                            </div>
                            <p className="font-bold text-white truncate leading-tight">
                              {skin.name}
                            </p>
                            <p className="mt-0.5 text-gray-500 text-xs truncate">
                              Ready for battle
                            </p>
                          </div>

                          {/* Unequip Button (Visible on Hover) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveSkin(type);
                            }}
                            className="top-2 right-2 absolute bg-black/40 hover:bg-black/80 opacity-0 group-hover:opacity-100 p-1.5 rounded-full text-gray-400 hover:text-red-400 transition-all"
                            title="Unequip"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      // === 3. EMPTY STATE CARD ===
                      <div className="relative flex justify-center items-center gap-3 bg-gray-800/30 hover:bg-gray-800/50 border-2 border-gray-700 hover:border-gray-600 border-dashed rounded-2xl h-24 transition-colors">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-xl grayscale opacity-30 ${config.bgIcon}`}
                        >
                          {config.icon}
                        </div>
                        <div className="opacity-40 text-left">
                          <p className="font-bold text-white text-sm uppercase">
                            Empty Slot
                          </p>
                          <p className="text-gray-400 text-xs">
                            Select skin from inventory
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-8 lg:col-span-8">
          <div className="bg-gray-900/40 backdrop-blur-xl p-6 border border-white/10 rounded-3xl min-h-[430px]">
            <div className="flex sm:flex-row flex-col justify-between items-start sm:items-center gap-4 mb-6">
              <h3 className="flex items-center gap-2 font-bold text-white text-xl">
                <Package className="w-5 h-5 text-purple-400" />
                Inventory{' '}
                <span className="font-normal text-gray-500 text-sm">
                  ({nftInventory.length})
                </span>
              </h3>

              {/* Filter Group */}
              <div className="flex bg-gray-800 p-1 rounded-xl">
                {(['all', 'rock', 'paper', 'scissors'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                      filter === f
                        ? 'bg-gray-700 text-white shadow-sm'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Inventory Grid */}
            {isLoadingNFTs ? (
              <div className="py-20 text-gray-500 text-center animate-pulse">
                Loading items...
              </div>
            ) : filteredNFTs.length === 0 ? (
              <div className="py-20 text-gray-500 text-center">
                No skins found in this category.
              </div>
            ) : (
              <div className="gap-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {filteredNFTs.map((nft) => {
                  const isEquipped = selectedSkins[nft.type]?.id === nft.id;
                  return (
                    <button
                      key={nft.id}
                      onClick={() => onSelectSkin(nft)}
                      className={`relative group bg-gray-800/50 rounded-2xl overflow-hidden border-2 transition-all hover:-translate-y-1 ${
                        isEquipped
                          ? 'border-emerald-500 shadow-lg shadow-emerald-500/10'
                          : 'border-transparent hover:border-gray-600'
                      }`}
                    >
                      <div className="relative w-full aspect-square">
                        <img
                          src={nft.image_url}
                          alt={nft.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="top-2 right-2 absolute bg-black/60 backdrop-blur px-2 py-0.5 rounded text-white text-xs">
                          {CHOICE_CONFIG[nft.type].icon}
                        </div>
                      </div>
                      <div className="p-3 text-left">
                        <p className="font-bold text-white text-sm truncate">
                          {nft.name}
                        </p>
                        {isEquipped && (
                          <p className="mt-1 font-medium text-emerald-400 text-xs">
                            ● Equipped
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-white/10">
        <MintSkinForm onSuccess={fetchUserNFTs} />
      </div>
    </div>
  );
}
