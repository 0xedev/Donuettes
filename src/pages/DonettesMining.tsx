import { Gem } from "lucide-react";
import { motion } from "framer-motion";
import {
  useAccount,
  useReadContract,
  useSendCalls,
  useCallsStatus,
} from "wagmi";
import { Address } from "viem";
import {
  DonuetteMinerABI,
  DonuetteMinerAddress,
  DONUT_TOKEN_ABI,
} from "./constant";
import { useEffect, useState } from "react";

export function DonettesMining() {
  const { address } = useAccount();
  const { data: callsId } = useSendCalls();

  const { data: callsStatus } = useCallsStatus({
    id: callsId?.id as string,
    query: {
      enabled: !!callsId,
      refetchInterval: (data) =>
        data.state.status === "success" && data.state.data?.status === "success"
          ? false
          : 1000,
    },
  });

  const isConfirmed = callsStatus?.status === "success";

  // Read Miner Data
  const { data: donutAddress } = useReadContract({
    address: DonuetteMinerAddress,
    abi: DonuetteMinerABI,
    functionName: "donut",
  });

  const { refetch: refetchPrice } = useReadContract({
    address: DonuetteMinerAddress,
    abi: DonuetteMinerABI,
    functionName: "getPrice",
  });

  useReadContract({
    address: DonuetteMinerAddress,
    abi: DonuetteMinerABI,
    functionName: "getDps",
  });

  const { data: slot0, refetch: refetchSlot0 } = useReadContract({
    address: DonuetteMinerAddress,
    abi: DonuetteMinerABI,
    functionName: "getSlot0",
  });

  useReadContract({
    address: donutAddress as Address,
    abi: DONUT_TOKEN_ABI,
    functionName: "balanceOf",
    args: [address as Address],
    query: {
      enabled: !!address && !!donutAddress,
    },
  });

  const currentMiner = slot0?.miner;

  const [, setMinerUsername] = useState<string | null>(null);

  // Fetch Farcaster username for current miner
  useEffect(() => {
    const fetchUsername = async () => {
      if (!currentMiner) {
        setMinerUsername(null);
        return;
      }

      try {
        const response = await fetch(
          `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${currentMiner}`,
          {
            headers: {
              api_key: import.meta.env.VITE_NEYNAR_API_KEY,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const user = data[currentMiner.toLowerCase()]?.[0];
          if (user?.username) {
            setMinerUsername(user.username);
          } else {
            setMinerUsername(null);
          }
        }
      } catch (error) {
        console.error("Failed to fetch username:", error);
        setMinerUsername(null);
      }
    };

    fetchUsername();
  }, [currentMiner]);

  // Refresh data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      refetchPrice();
      refetchSlot0();
    }, 2000);
    return () => clearInterval(interval);
  }, [refetchPrice, refetchSlot0]);

  // Refetch on transaction confirmation
  useEffect(() => {
    if (isConfirmed) {
      refetchPrice();
      refetchSlot0();
    }
  }, [isConfirmed, refetchPrice, refetchSlot0]);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <h2 className="text-2xl font-bold flex items-center justify-center gap-2 text-purple-700">
          <Gem className="w-6 h-6" />
          Mine Donettes
        </h2>
        <p className="text-sm opacity-80">
          Spend DONUT to mine Donettes tokens.
        </p>
      </motion.div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 space-y-4 shadow-sm">
        <h3 className="text-lg font-bold text-yellow-900 flex items-center gap-2">
          ⚠️ Important Announcement: Mining Update
        </h3>
        <div className="space-y-3 text-sm text-yellow-800">
          <p>
            <strong>New Update on $donuette:</strong> Mining is currently botted
            and inefficient. The more LP added, the more bots kept selling. I've
            decided to stop the mining process at{" "}
            <strong>1m total supply</strong>.
          </p>
          <p>
            A new <strong>$donuette</strong> will be deployed. A snapshot of
            holders will be taken at 1m total supply. Users can claim{" "}
            <strong>1:1</strong>. Current house funds and LP will be added to
            the new LP and locked forever.
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Max supply of 1.2m (200k added to current LP as liquidity)</li>
            <li>LP locked forever</li>
            <li>1:1 claiming via Merkle Airdrop</li>
            <li>
              Snapshot at 1m Total Supply - any mining after that will not count
            </li>
          </ul>
          <p className="font-bold text-red-600">
            Frontend will be be updated with migration button.
          </p>
        </div>
      </div>
    </div>
  );
}
