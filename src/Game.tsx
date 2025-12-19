import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useEffect, useState, useRef } from 'react';
import {
  POOL_DATA_ID,
  MODULE_NAME,
  PACKAGE_ID,
  TREASURY_CAP_ID,
  FAUCET_DATA_ID,
  ADMIN_ADDRESS,
} from './constants';
import { useGGCBalance } from './hooks/useGGCBalance';
import { toast } from 'sonner';

// --- Configuration ---
const BET_OPTIONS = [10, 20, 50, 100];

// --- Types ---
type Choice = 'scissors' | 'rock' | 'paper';
type GameResult = 'win' | 'lose' | 'draw' | null;

const CHOICE_TO_NUMBER: Record<Choice, number> = {
  scissors: 0,
  rock: 1,
  paper: 2,
};

const NUMBER_TO_CHOICE: Record<number, Choice> = {
  0: 'scissors',
  1: 'rock',
  2: 'paper',
};

const OUTCOME_MAP: Record<number, GameResult> = {
  0: 'lose',
  1: 'win',
  2: 'draw',
};

const CHOICES = {
  scissors: '✌️',
  rock: '👊',
  paper: '✋',
};

// --- Animation Component ---
const BalanceDelta = ({ currentBalance }: { currentBalance: number }) => {
  const [delta, setDelta] = useState<{ val: number; id: number } | null>(null);
  const prevBalance = useRef(currentBalance);

  useEffect(() => {
    const diff = currentBalance - prevBalance.current;
    if (Math.abs(diff) > 0.01) {
      setDelta({ val: diff, id: Date.now() });
      const timer = setTimeout(() => setDelta(null), 1500);
      prevBalance.current = currentBalance;
      return () => clearTimeout(timer);
    }
  }, [currentBalance]);

  if (!delta) return null;

  const isPositive = delta.val > 0;
  const text = isPositive
    ? `+${delta.val.toFixed(2)}`
    : `${delta.val.toFixed(2)}`;
  const color = isPositive ? 'text-emerald-400' : 'text-red-400';

  return (
    <span
      key={delta.id}
      className={`absolute left-full ml-3 top-0 font-mono text-sm font-bold ${color} animate-float-fade whitespace-nowrap`}
    >
      {text}
    </span>
  );
};

export default function RockPaperScissorsGame() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { data: balance, refetch: refetchBalance } = useGGCBalance();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      await client.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showRawEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      }),
  });

  const [poolBalance, setPoolBalance] = useState<number>(0);
  const [faucetBalance, setFaucetBalance] = useState<number>(0);
  const [playerChoice, setPlayerChoice] = useState<Choice | null>(null);
  const [botChoice, setBotChoice] = useState<Choice | null>(null);
  const [result, setResult] = useState<GameResult>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scores, setScores] = useState({ player: 0, bot: 0, draws: 0 });
  const [betAmount, setBetAmount] = useState<number>(10);

  const currentBalance = parseFloat(balance || '0');
  const hasEnoughBalance = currentBalance >= betAmount;

  const isAdmin = account?.address === ADMIN_ADDRESS;

  // --- Helpers ---
  const refreshData = async () => {
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      fetchSystemBalances();
      refetchBalance();
    }
  };

  const fetchSystemBalances = async () => {
    try {
      const [poolObj, faucetObj] = await Promise.all([
        client.getObject({ id: POOL_DATA_ID, options: { showContent: true } }),
        client.getObject({
          id: FAUCET_DATA_ID,
          options: { showContent: true },
        }),
      ]);

      if (poolObj.data?.content?.dataType === 'moveObject') {
        const fields = poolObj.data.content.fields as any;
        const raw = fields.balance?.value || fields.balance || '0';
        setPoolBalance(parseInt(raw) / 1_000_000_000);
      }

      if (faucetObj.data?.content?.dataType === 'moveObject') {
        const fields = faucetObj.data.content.fields as any;
        const raw = fields.balance?.value || fields.balance || '0';
        setFaucetBalance(parseInt(raw) / 1_000_000_000);
      }
    } catch (error) {
      console.error('Error fetching system balances:', error);
    }
  };

  useEffect(() => {
    fetchSystemBalances();
  }, [client]);

  const resetGame = () => {
    setPlayerChoice(null);
    setBotChoice(null);
    setResult(null);
  };

  // --- Transactions ---

  const claimGGC = () => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::claim_faucet`,
      arguments: [
        tx.object(FAUCET_DATA_ID),
        tx.object('0x6'), // Clock
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          toast.success('GGC Claimed!');
          refreshData();
        },
        onError: (err) => toast.error('Claim Failed: ' + err.message),
      }
    );
  };

  const depositToPool = () => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::deposit_to_pool`,
      arguments: [tx.object(POOL_DATA_ID), tx.object(TREASURY_CAP_ID)],
    });
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: refreshData,
        onError: (err) => toast.error('Deposit failed: ' + err.message),
      }
    );
  };

  const fillFaucet = () => {
    const tx = new Transaction();
    const AMOUNT_TO_FILL = 1000 * 1_000_000_000;

    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::fill_faucet`,
      arguments: [
        tx.object(FAUCET_DATA_ID),
        tx.object(TREASURY_CAP_ID),
        tx.pure.u64(AMOUNT_TO_FILL),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: refreshData,
        onError: (err) => toast.error('Fill failed: ' + err.message),
      }
    );
  };

  const play = async (choiceKey: string) => {
    if (!account) return;

    if (!hasEnoughBalance) {
      toast.error(`Insufficient Funds! You need ${betAmount} GGC to play.`);
      return;
    }

    setIsProcessing(true);
    setPlayerChoice(choiceKey as Choice);

    try {
      const tx = new Transaction();
      const MIST = 1_000_000_000;
      const requiredMist = betAmount * MIST;

      const { data: coins } = await client.getCoins({
        owner: account.address,
        coinType: `${PACKAGE_ID}::ggc::GGC`,
      });

      if (!coins || coins.length === 0) {
        throw new Error('No GGC coins found in wallet.');
      }

      let primaryCoinInput = tx.object(coins[0].coinObjectId);
      if (coins.length > 1) {
        tx.mergeCoins(
          primaryCoinInput,
          coins.slice(1).map((c) => tx.object(c.coinObjectId))
        );
      }

      const [betCoin] = tx.splitCoins(primaryCoinInput, [
        tx.pure.u64(requiredMist),
      ]);

      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::play`,
        arguments: [
          tx.object(POOL_DATA_ID),
          betCoin,
          tx.pure.u8(CHOICE_TO_NUMBER[choiceKey as Choice]),
          tx.object('0x8'),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: (result) => {
            const event = result.events?.find((e) =>
              e.type.includes('GameResult')
            );

            if (event && event.parsedJson) {
              const data = event.parsedJson as any;
              const outcome = OUTCOME_MAP[Number(data.outcome)];

              setBotChoice(NUMBER_TO_CHOICE[Number(data.house_choice)]);
              setResult(outcome);

              setScores((prev) => ({
                ...prev,
                player: outcome === 'win' ? prev.player + 1 : prev.player,
                bot: outcome === 'lose' ? prev.bot + 1 : prev.bot,
                draws: outcome === 'draw' ? prev.draws + 1 : prev.draws,
              }));

              refreshData();
            }
            setIsProcessing(false);
          },
          onError: (err) => {
            toast.error('Transaction Failed: ' + err.message);
            setIsProcessing(false);
            setPlayerChoice(null);
          },
        }
      );
    } catch (e: any) {
      toast.error(e.message);
      setIsProcessing(false);
      setPlayerChoice(null);
    }
  };

  // --- UI Logic ---

  const getResultColor = () => {
    if (result === 'win') return 'bg-green-600';
    if (result === 'lose') return 'bg-red-600';
    if (result === 'draw') return 'bg-yellow-600';
    return 'bg-gray-800';
  };

  const getHeaderText = () => {
    if (isProcessing) return 'FIGHTING...';
    if (result === 'win') return 'VICTORY!';
    if (result === 'lose') return 'DEFEAT';
    if (result === 'draw') return 'DRAW';
    return 'RPS BATTLE';
  };

  const getSubHeaderText = () => {
    if (isProcessing) return 'Waiting for blockchain...';
    if (result === 'win') return `+${betAmount * 2} GGC`;
    if (result === 'lose') return `-${betAmount} GGC`;
    if (result === 'draw') return 'Bet Refunded';
    return 'Select your weapon';
  };

  return (
    <div className="flex justify-center items-center bg-gray-900 p-4 min-h-screen font-sans">
      {/* GRID CONTAINER: Side-by-Side Layout */}
      <div
        className={`grid grid-cols-1 ${
          isAdmin
            ? 'md:grid-cols-[1fr_1.5fr]'
            : 'md:grid-cols-1 justify-items-center'
        } gap-8 w-full max-w-6xl`}
      >
        {/* --- LEFT COLUMN: ADMIN DASHBOARD --- */}
        {isAdmin && (
          <div className="relative bg-gray-800 shadow-2xl p-8 border border-purple-500/30 rounded-3xl w-full h-fit overflow-hidden">
            <div className="top-0 left-0 absolute bg-gradient-to-r from-purple-500 to-pink-500 w-full h-1"></div>
            <h3 className="flex items-center gap-2 mb-6 font-black text-white text-2xl uppercase tracking-widest">
              🛡️ Admin Panel
            </h3>

            <div className="space-y-6">
              {/* Status Cards */}
              <div className="space-y-4">
                <div className="flex justify-between items-end bg-black/40 p-6 border border-white/5 rounded-2xl">
                  <div>
                    <div className="mb-1 font-bold text-white/40 text-xs uppercase">
                      House Pool
                    </div>
                    <div className="font-mono font-bold text-white text-3xl tracking-tight">
                      {poolBalance.toLocaleString()}
                    </div>
                  </div>
                  <img
                    src="coin.png"
                    className="size-9"
                    width={18}
                    height={18}
                  />
                </div>

                <div className="flex justify-between items-end bg-black/40 p-6 border border-white/5 rounded-2xl">
                  <div>
                    <div className="mb-1 font-bold text-white/40 text-xs uppercase">
                      Faucet Tank
                    </div>
                    <div className="font-mono font-bold text-white text-3xl tracking-tight">
                      {faucetBalance.toLocaleString()}
                    </div>
                  </div>
                  <img
                    src="coin.png"
                    className="size-9"
                    width={18}
                    height={18}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="gap-4 grid grid-cols-1 pt-4 border-white/5 border-t">
                <button
                  onClick={depositToPool}
                  className="bg-purple-600 hover:bg-purple-500 shadow-lg hover:shadow-purple-500/20 py-4 rounded-xl font-bold text-white text-sm uppercase tracking-wider transition-all"
                >
                  ⚡ Refill House (1000 GGC)
                </button>
                <button
                  onClick={fillFaucet}
                  className="bg-pink-600 hover:bg-pink-500 shadow-lg hover:shadow-pink-500/20 py-4 rounded-xl font-bold text-white text-sm uppercase tracking-wider transition-all"
                >
                  💧 Refill Faucet (1000 GGC)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- RIGHT COLUMN: GAME CARD --- */}
        <div
          className={`${getResultColor()} shadow-2xl rounded-3xl w-full max-w-xl relative transition-all duration-500 overflow-hidden border border-white/10`}
        >
          {/* Header / Result Area */}
          <div className="z-10 relative p-8 text-white text-center">
            {/* Bet Mode Selector */}
            {!result && !isProcessing && (
              <div className="flex flex-col items-center mt-2 mb-6">
                <span className="mb-2 font-bold text-[10px] text-white/40 uppercase tracking-widest">
                  Stake Amount
                </span>
                <div className="flex bg-black/40 backdrop-blur-sm p-1 border border-white/5 rounded-xl">
                  {BET_OPTIONS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setBetAmount(amount)}
                      className={`
                        px-4 py-2 rounded-lg text-sm font-bold transition-all min-w-[80px]
                        ${
                          betAmount === amount
                            ? 'bg-yellow-400 text-black shadow-lg scale-105'
                            : 'text-white/40 hover:text-white hover:bg-white/5'
                        }
                      `}
                    >
                      {amount}{' '}
                      <span className="opacity-60 text-[10px]">GGC</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Main Title */}
            <div className="flex flex-col justify-center items-center gap-2 mb-8 h-32">
              <h2 className="drop-shadow-md font-black text-4xl md:text-6xl uppercase tracking-tighter animate-in duration-300 fade-in zoom-in">
                {getHeaderText()}
              </h2>
              <p className="font-medium text-white/80 text-xl tracking-wide">
                {getSubHeaderText()}
              </p>
            </div>

            {/* Battle Arena */}
            <div className="flex justify-between items-center mb-8 px-4 w-full">
              <div className="flex flex-col items-center w-1/3 transition-all duration-300">
                <div className="text-7xl">
                  {playerChoice ? CHOICES[playerChoice] : '❓'}
                </div>
                <span className="bg-white/10 mt-4 px-3 py-1 rounded-full font-bold text-[10px] text-white/60 uppercase tracking-widest">
                  You
                </span>
              </div>

              <div className="w-1/3 font-black text-white/20 text-4xl italic">
                VS
              </div>

              <div className="flex flex-col items-center w-1/3 transition-all duration-300">
                <div
                  className={`text-7xl ${isProcessing ? 'animate-bounce' : ''}`}
                >
                  {botChoice ? CHOICES[botChoice] : '🤖'}
                </div>
                <span className="bg-white/10 mt-4 px-3 py-1 rounded-full font-bold text-[10px] text-white/60 uppercase tracking-widest">
                  Bot
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="mt-8 h-24">
              {result ? (
                <button
                  onClick={resetGame}
                  className="slide-in-from-bottom-4 bg-white hover:bg-gray-100 shadow-xl hover:shadow-2xl py-4 rounded-2xl w-full font-black text-gray-900 text-xl uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all animate-in transform"
                >
                  Play Again
                </button>
              ) : (
                <div className="gap-4 grid grid-cols-3">
                  {(Object.keys(CHOICES) as Choice[]).map((choice) => (
                    <button
                      key={choice}
                      onClick={() => play(choice)}
                      disabled={isProcessing || !account || !hasEnoughBalance}
                      className={`
                            bg-black/20 
                            rounded-2xl p-4 text-5xl
                            border-2 border-transparent hover:border-white/20
                            transition-all duration-200
                            shadow-lg
                            hover:bg-black/40 hover:scale-110 active:scale-90
                            disabled:opacity-50 
                            disabled:cursor-not-allowed
                            disabled:transform-none
                            disabled:hover:scale-100
                            disabled:active:scale-100
                            disabled:hover:bg-black/20
                        `}
                    >
                      {CHOICES[choice]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!hasEnoughBalance && account && !result && (
              <div className="mt-4 font-bold text-red-300 text-sm animate-pulse">
                Insufficient Balance! You need {betAmount} GGC.
              </div>
            )}
          </div>

          {/* Footer Stats */}
          <div className="bg-black/40 backdrop-blur-md p-6 border-white/5 border-t text-white">
            {!account ? (
              <div className="flex flex-col items-center gap-4">
                <p className="opacity-80 font-medium">
                  Connect wallet to start
                </p>
                <ConnectButton />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <ConnectButton />
                    <div className="relative flex flex-col pl-2">
                      <span className="font-bold text-[10px] text-white/50 uppercase">
                        Your Balance
                      </span>

                      <div className="relative">
                        <span
                          className={`flex gap-2 items-center
                                    font-mono font-bold transition-colors duration-300
                                    ${
                                      !hasEnoughBalance
                                        ? 'text-red-400'
                                        : 'text-emerald-400'
                                    }
                                `}
                        >
                          {balance ?? '0.00'}
                          <img
                            src="coin.png"
                            className="size-5"
                            width={18}
                            height={18}
                          />
                        </span>
                        <BalanceDelta currentBalance={currentBalance} />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={claimGGC}
                      className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold text-xs transition-colors"
                    >
                      + Faucet
                    </button>
                  </div>
                </div>

                <div className="flex justify-between pt-4 border-white/10 border-t">
                  <div className="text-center">
                    <div className="font-bold text-xl">{scores.player}</div>
                    <div className="text-[10px] text-white/40 uppercase">
                      Wins
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-xl">{scores.draws}</div>
                    <div className="text-[10px] text-white/40 uppercase">
                      Draws
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-xl">{scores.bot}</div>
                    <div className="text-[10px] text-white/40 uppercase">
                      Losses
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
