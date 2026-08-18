import {
  useSignAndExecuteTransaction,
  useCurrentAccount,
  useSuiClient,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, Wand2, Link as LinkIcon, Type, Coins } from 'lucide-react';
import { GGC_MODULE, GG_NFT_MODULE, MIST } from './constants';

const GESTURES = [
  { id: 'Rock', icon: '👊' },
  { id: 'Paper', icon: '✋' },
  { id: 'Scissors', icon: '✌️' },
];

const MINT_FEE = 150; // Cost in GGC

export default function MintSkinForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [isLoading, setIsLoading] = useState(false);
  const [userGGCBalance, setUserGGCBalance] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    imageUrl: '',
    gesture: 'Rock',
  });

  // Check user's GGC balance for UI feedback
  useEffect(() => {
    if (account) {
      fetchBalance();
    }
  }, [account]);

  const fetchBalance = async () => {
    if (!account) return;
    try {
      const { totalBalance } = await client.getBalance({
        owner: account.address,
        coinType: `${GGC_MODULE}::GGC`,
      });
      setUserGGCBalance(parseInt(totalBalance) / 1_000_000_000);
    } catch (e) {
      console.error('Failed to fetch balance', e);
    }
  };

  const handleMint = async () => {
    if (!account) return toast.error('Connect wallet first');
    if (!formData.name || !formData.imageUrl)
      return toast.error('Name and Image URL are required');
    if (userGGCBalance < MINT_FEE)
      return toast.error(`Insufficient GGC. You need ${MINT_FEE} GGC.`);

    setIsLoading(true);
    try {
      const tx = new Transaction();

      const { data: coins } = await client.getCoins({
        owner: account.address,
        coinType: `${GGC_MODULE}::GGC`,
      });

      if (!coins || coins.length === 0) throw new Error('No GGC coins found');

      let primaryCoinInput = tx.object(coins[0].coinObjectId);
      if (coins.length > 1) {
        tx.mergeCoins(
          primaryCoinInput,
          coins.slice(1).map((c) => tx.object(c.coinObjectId))
        );
      }

      const [feeCoin] = tx.splitCoins(primaryCoinInput, [
        tx.pure.u64(MINT_FEE * MIST),
      ]);

      tx.moveCall({
        target: `${GG_NFT_MODULE}::mint_nft`,
        arguments: [
          tx.pure.string(formData.name),
          tx.pure.string(formData.description),
          tx.pure.string(formData.imageUrl),
          tx.pure.string(formData.gesture),
          feeCoin,
        ],
      });

      signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: () => {
            toast.success(`Minted successfully! Fee: ${MINT_FEE} GGC`);
            setFormData({
              name: '',
              description: '',
              imageUrl: '',
              gesture: 'Rock',
            });
            fetchBalance();
            if (onSuccess) onSuccess();
          },
          onError: (err) => {
            console.error(err);
            toast.error('Mint failed. See console.');
          },
        }
      );
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Transaction failed');
    } finally {
      setIsLoading(false);
    }
  };

  const hasEnoughFunds = userGGCBalance >= MINT_FEE;

  return (
    <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 shadow-2xl p-8 border border-white/10 rounded-3xl overflow-hidden">
      {/* Decorative background glow */}
      <div className="top-0 right-0 absolute bg-emerald-500/10 blur-3xl rounded-full w-64 h-64 -translate-y-1/2 translate-x-1/2 pointer-events-none" />

      <div className="z-10 relative flex items-center gap-3 mb-8">
        <div className="bg-emerald-500/20 p-2 rounded-lg">
          <Wand2 className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h2 className="font-bold text-white text-2xl">Workshop</h2>
          <p className="text-gray-400 text-sm">
            Design and craft your own custom skin
          </p>
        </div>
      </div>

      <div className="z-10 relative gap-8 grid grid-cols-1 md:grid-cols-12">
        <div className="space-y-5 md:col-span-7">
          {/* Gesture Select */}
          <div>
            <label className="block mb-2 font-bold text-gray-400 text-xs uppercase tracking-wider">
              Skin Type
            </label>
            <div className="gap-3 grid grid-cols-3">
              {GESTURES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setFormData({ ...formData, gesture: g.id })}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                    formData.gesture === g.id
                      ? 'border-emerald-500 bg-emerald-500/10 text-white'
                      : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <span className="text-2xl">{g.icon}</span>
                  <span className="font-bold text-xs">{g.id}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Inputs */}
          <div className="space-y-4">
            <div className="group">
              <label className="block mb-1 font-bold text-gray-400 text-xs uppercase tracking-wider">
                Name
              </label>
              <div className="flex items-center bg-gray-800/80 px-4 py-3 border border-gray-700 focus-within:border-emerald-500 rounded-xl transition-colors">
                <Type className="mr-3 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="e.g. Golden Fist"
                  className="bg-transparent outline-none w-full text-white placeholder-gray-600"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <label className="block mb-1 font-bold text-gray-400 text-xs uppercase tracking-wider">
                Image URL
              </label>
              <div className="flex items-center bg-gray-800/80 px-4 py-3 border border-gray-700 focus-within:border-emerald-500 rounded-xl transition-colors">
                <LinkIcon className="mr-3 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="https://..."
                  className="bg-transparent outline-none w-full text-white placeholder-gray-600"
                  value={formData.imageUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, imageUrl: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <label className="block mb-1 font-bold text-gray-400 text-xs uppercase tracking-wider">
                Description (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Tell us about this skin..."
                className="bg-gray-800/80 px-4 py-3 border border-gray-700 focus:border-emerald-500 rounded-xl outline-none w-full text-white resize-none placeholder-gray-600"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
          </div>

          {/* Wallet Balance Info */}
          <div className="flex justify-end items-center gap-1 text-gray-500 text-xs">
            <Coins className="w-3 h-3" />
            Your Balance:{' '}
            <span className="font-mono font-bold text-emerald-400">
              {userGGCBalance} GGC
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4 md:col-span-5">
          {/* Preview Box */}
          <div className="group relative flex flex-col justify-center items-center bg-black/40 border-2 border-gray-700 border-dashed rounded-2xl aspect-square overflow-hidden">
            {formData.imageUrl ? (
              <>
                <img
                  src={formData.imageUrl}
                  alt="Preview"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
                <div className="right-0 bottom-0 left-0 absolute bg-black/70 backdrop-blur-sm p-3 text-white">
                  <p className="font-bold text-sm">
                    {formData.name || 'Skin Name'}
                  </p>
                  <p className="text-gray-300 text-xs">{formData.gesture}</p>
                </div>
              </>
            ) : (
              <div className="p-4 text-gray-600 text-center">
                <div className="mb-2 text-4xl">🎨</div>
                <p className="text-sm">Preview will appear here</p>
              </div>
            )}
          </div>

          {/* Create Button */}
          <button
            onClick={handleMint}
            disabled={isLoading || !account || !hasEnoughFunds}
            className={`
              w-full py-4 rounded-xl font-bold text-lg flex justify-center items-center gap-2 transition-all shadow-lg
              ${
                hasEnoughFunds
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-900/20'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {isLoading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                <span>Create Skin</span>
                <span className="flex items-center gap-1 bg-yellow-400/80 px-2 py-0.5 rounded font-mono text-sm">
                  {MINT_FEE} GGC
                </span>
              </>
            )}
          </button>

          {!hasEnoughFunds && account && (
            <p className="font-bold text-red-400 text-xs text-center">
              Insufficient Balance: {userGGCBalance} / {MINT_FEE} GGC
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
