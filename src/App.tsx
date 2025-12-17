import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Puzzle, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useSuiBalance } from './hooks/useSuiBalance';
import type { SuiEvent } from '@mysten/sui/client';
import { useEffect, useState } from 'react';

// Move module configuration
const PACKAGE_ID =
  '0x8ca87bbc53db9ddd044c3e0b622bb1c86a04fd4d528ac278673996ad8dea904c'; // Replace with your deployed package ID
const MODULE_NAME = 'rps'; // Replace with your module name
const HOUSE_OBJECT_ID =
  '0xf16da9961209675d42cdba104d3a7f3ce0ff87f6615b71ecdec097e66b763fa1';
const BET_AMOUNT_SUI = 0.1;
const BET_AMOUNT_MIST = BET_AMOUNT_SUI * 1_000_000_000;

export default function App() {
  const account = useCurrentAccount()!;
  const client = useSuiClient();
  const { data: balance, refetch: balanceRefetch } = useSuiBalance();
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
  const [houseBalance, setHouseBalance] = useState<number>();

  useEffect(() => {
    getHouseBalance();
  }, []);

  const hasEnoughBalance = balance ? +balance >= BET_AMOUNT_SUI : false;

  function startGame() {
    if (!account) return;
    const tx = new Transaction();

    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(BET_AMOUNT_MIST)]);
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::play_game`,
      arguments: [
        tx.object(HOUSE_OBJECT_ID),
        coin,
        tx.pure.bool(true),
        tx.object('0x8'),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async (res) => {
          console.log('Game created successfully:', res);

          const gameResult = res.events?.find(
            (e: SuiEvent) =>
              e.type === `${PACKAGE_ID}::${MODULE_NAME}::GameResult`
          );

          if (!gameResult) {
            toast.error('There is no announcement');
            return;
          }

          const payload = gameResult.parsedJson as {
            player_won: boolean;
          };

          console.log(payload);
          const playerWon = payload.player_won;

          if (playerWon) toast.success('YOu win!');
          else toast.error('YOu fxxxing loost!!');

          await balanceRefetch();
          await getHouseBalance();
        },
        onError: (error) => {
          console.error('Error creating game:', error);
          toast.error('Failed to create game. Please try again.');
        },
      }
    );
  }

  function depositToHouse(amountMist: number) {
    const tx = new Transaction();

    // Split the deposit amount from gas
    const [coin] = tx.splitCoins(tx.gas, [amountMist]);

    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::deposit_to_house`,
      arguments: [
        tx.object(HOUSE_OBJECT_ID), // HouseData
        coin, // Deposit amount
      ],
    });

    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: async (result) => {
          console.log('Deposited to house:', result.digest);
        },
        onError: (error) => {
          console.error('Error processing game:', error);
          toast.error('Failed to process game. Please try again.');
        },
      }
    );
  }

  async function getHouseBalance() {
    const houseObject = await client.getObject({
      id: HOUSE_OBJECT_ID,
      options: {
        showContent: true,
      },
    });

    if (houseObject.data?.content?.dataType === 'moveObject') {
      const fields = houseObject.data.content.fields as any;
      // The balance is stored as an object with a 'value' field
      const balance = parseInt(fields.balance || '0');
      setHouseBalance(balance);
    }
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 min-h-screen">
      <div className="mx-auto max-w-2xl">
        {/* Wallet Info Card */}
        <div className="bg-white shadow-lg mb-6 p-6 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <Wallet className="w-6 h-6 text-indigo-600" />
              <h2 className="font-semibold text-gray-800">Wallet Info</h2>
            </div>
          </div>

          {account ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                <span className="text-gray-600 text-sm">Address:</span>
                <span className="font-mono text-gray-800 text-sm">
                  <ConnectButton />
                </span>
              </div>
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                <span className="text-gray-600 text-sm">Balance:</span>
                <span className="font-semibold text-gray-800 text-sm">
                  {balance} SUI
                </span>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="mb-3 text-gray-600">
                Please connect your wallet to continue
              </p>
              <ConnectButton />
            </div>
          )}
        </div>

        {/* Game Info Card */}
        <div className="bg-white shadow-lg mb-6 p-6 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <Puzzle className="w-6 h-6 text-indigo-600" />
              <h2 className="font-semibold text-gray-800">Game Info</h2>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
              <span className="text-gray-600 text-sm">House Balance:</span>
              <span className="font-semibold text-gray-800 text-sm">
                {houseBalance} SUI
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            className="p-4 outline"
            onClick={startGame}
            disabled={!hasEnoughBalance}
          >
            Start game
          </button>

          <button
            className="p-4 outline"
            onClick={() => depositToHouse(2_000_000_000)} // 2 SUI
          >
            Deposit 2 SUI
          </button>
        </div>
      </div>
    </div>
  );
}
