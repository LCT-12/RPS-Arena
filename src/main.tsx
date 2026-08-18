import {
  createNetworkConfig,
  SuiClientProvider,
  WalletProvider,
} from '@mysten/dapp-kit';
import '@mysten/dapp-kit/dist/index.css';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './index.css';
import { Toaster } from './components/sonner';
import RockPaperScissorsGame from './Game';

const root = document.getElementById('root');

const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
});

const queryClient = new QueryClient();

ReactDOM.createRoot(root as HTMLElement).render(
  <QueryClientProvider client={queryClient}>
    <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
      <WalletProvider autoConnect>
        <Toaster />
        <BrowserRouter>
          <RockPaperScissorsGame />
        </BrowserRouter>
      </WalletProvider>
    </SuiClientProvider>
  </QueryClientProvider>
);
