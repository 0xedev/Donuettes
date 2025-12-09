import { sdk } from "@farcaster/miniapp-sdk";
import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Navigation } from "./components/Navigation";
import { CommunityMining } from "./pages/CommunityMining";
import { DonettesMining } from "./pages/DonettesMining";
import { Button } from "./components/ui/Button";

function App() {
  const [activeTab, setActiveTab] = useState<"community" | "donettes">(
    "donettes"
  );
  const [hasPromptedAdd, setHasPromptedAdd] = useState(false);
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  useEffect(() => {
    sdk.actions.ready();

    if (!isConnected && connectors.length > 0) {
      const connector =
        connectors.find((c) => c.id === "farcaster") || connectors[0];
      if (connector) {
        connect({ connector });
      }
    }
  }, [isConnected, connect, connectors]);

  useEffect(() => {
    const promptAddMiniApp = async () => {
      if (hasPromptedAdd) return;

      try {
        const context = await sdk.context;
        if (!context.client.added) {
          await sdk.actions.addMiniApp();
          setHasPromptedAdd(true);
        }
      } catch (error) {
        console.log("User declined to add mini app");
        setHasPromptedAdd(true);
      }
    };

    promptAddMiniApp();
  }, [hasPromptedAdd]);

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto pb-20">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-black italic tracking-tighter">
          🍩 Donuettes
        </h1>
        <ConnectMenu />
      </header>

      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      <main>
        {activeTab === "community" ? <CommunityMining /> : <DonettesMining />}
      </main>
    </div>
  );
}

function ConnectMenu() {
  const { isConnected, address } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <Button
        variant="outline"
        onClick={() => disconnect()}
        className="text-xs py-1 px-2 h-auto"
      >
        {address?.slice(0, 4)}...{address?.slice(-4)}
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      {connectors.map((connector) => (
        <Button
          key={connector.uid}
          variant="primary"
          onClick={() => connect({ connector })}
          className="text-xs py-1 px-2 h-auto"
        >
          {connector.name === "Injected" ? "Wallet" : connector.name}
        </Button>
      ))}
    </div>
  );
}

export default App;
