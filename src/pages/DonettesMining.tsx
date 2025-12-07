import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Gem, Zap, TrendingDown, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import {
  useAccount,
  useReadContract,
  useSendCalls,
  useCallsStatus,
} from "wagmi";
import { formatEther, Address, encodeFunctionData } from "viem";
import {
  DonuetteMinerABI,
  DonuetteMinerAddress,
  DONUT_TOKEN_ABI,
} from "./constant";
import { useEffect, useState } from "react";

export function DonettesMining() {
  const { address } = useAccount();
  const {
    sendCalls,
    data: callsId,
    isPending,
    error: sendError,
  } = useSendCalls();

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

  const isConfirming = callsStatus?.status === "pending";
  const isConfirmed = callsStatus?.status === "success";

  // Read Miner Data
  const { data: donutAddress } = useReadContract({
    address: DonuetteMinerAddress,
    abi: DonuetteMinerABI,
    functionName: "donut",
  });

  const { data: currentPrice, refetch: refetchPrice } = useReadContract({
    address: DonuetteMinerAddress,
    abi: DonuetteMinerABI,
    functionName: "getPrice",
  });

  const { data: dps } = useReadContract({
    address: DonuetteMinerAddress,
    abi: DonuetteMinerABI,
    functionName: "getDps",
  });

  const { data: slot0, refetch: refetchSlot0 } = useReadContract({
    address: DonuetteMinerAddress,
    abi: DonuetteMinerABI,
    functionName: "getSlot0",
  });

  const { data: donutBalance } = useReadContract({
    address: donutAddress as Address,
    abi: DONUT_TOKEN_ABI,
    functionName: "balanceOf",
    args: [address as Address],
    query: {
      enabled: !!address && !!donutAddress,
    },
  });

  const currentMiner = slot0?.miner;
  const timeElapsed = slot0?.startTime
    ? Math.floor(Date.now() / 1000 - Number(slot0.startTime))
    : 0;

  const [minerUsername, setMinerUsername] = useState<string | null>(null);

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

  const hasInsufficientBalance =
    donutBalance !== undefined &&
    currentPrice !== undefined &&
    donutBalance < currentPrice;

  const handleMine = () => {
    if (!currentPrice || !donutAddress || !address) return;

    if (hasInsufficientBalance) {
      return; // Button should be disabled
    }

    // Batch approve + mine into a single transaction
    sendCalls({
      calls: [
        {
          to: donutAddress as Address,
          data: encodeFunctionData({
            abi: DONUT_TOKEN_ABI,
            functionName: "approve",
            args: [DonuetteMinerAddress, currentPrice],
          }),
        },
        {
          to: DonuetteMinerAddress,
          data: encodeFunctionData({
            abi: DonuetteMinerABI,
            functionName: "mine",
            args: [
              address,
              "0x52ed0d237c809714c612218c6cfea6d202690863", // provider
              BigInt(slot0?.epochId || 0),
              BigInt(Math.floor(Date.now() / 1000) + 3600), // deadline
              currentPrice * 2n, // maxPrice (allow some slippage)
              "",
            ],
          }),
        },
      ],
    });
  };

  const formatDonut = (val: bigint | undefined) => {
    if (!val) return "0.00";
    return parseFloat(formatEther(val)).toFixed(2);
  };

  const nextPrice = currentPrice ? currentPrice * 2n : 0n;

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

      <Card className="space-y-6 border-purple-900 shadow-[4px_4px_0px_0px_rgba(88,28,135,1)]">
        {currentMiner?.toLowerCase() === address?.toLowerCase() && (
          <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3 text-center">
            <p className="text-sm font-bold text-yellow-900">
              👑 You're currently holding the throne!
            </p>
            <p className="text-xs text-yellow-800 mt-1">
              You'll earn when the next person mines
            </p>
          </div>
        )}

        <div className="text-center space-y-1">
          <div className="text-sm opacity-60">Current Mining Price</div>
          <div className="text-4xl font-black text-purple-900">
            {formatDonut(currentPrice)} DONUT
          </div>
          <div className="text-xs text-red-500 flex items-center justify-center gap-1">
            <TrendingDown className="w-3 h-3" />
            Dropping every second
          </div>
        </div>

        {hasInsufficientBalance && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-4 space-y-2">
            <p className="text-sm font-bold text-red-900">
              ⚠️ Insufficient DONUT Balance
            </p>
            <p className="text-xs text-red-700">
              You need {formatDonut(currentPrice)} DONUT to mine, but you only
              have {formatDonut(donutBalance || 0n)} DONUT.
            </p>
            <p className="text-xs text-red-600">
              Get DONUT on{" "}
              <a
                href="https://app.uniswap.org/swap?outputCurrency=0x89D326378b7F807D9e8CF06e921E99D6CB85Bb0a&chain=base"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold"
              >
                Uniswap
              </a>{" "}
              or wait for the price to drop.
            </p>
          </div>
        )}

        <Button
          onClick={handleMine}
          disabled={
            isPending ||
            isConfirming ||
            !currentPrice ||
            !address ||
            hasInsufficientBalance
          }
          className="w-full py-4 text-lg bg-purple-400 hover:bg-purple-500 border-purple-900 shadow-[2px_2px_0px_0px_rgba(88,28,135,1)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending || isConfirming ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {isPending ? "Confirming..." : "Processing..."}
            </span>
          ) : hasInsufficientBalance ? (
            "Insufficient DONUT"
          ) : currentMiner?.toLowerCase() === address?.toLowerCase() ? (
            "You're the King Glazer! 👑"
          ) : (
            "Claim the Crown! 👑"
          )}
        </Button>

        {sendError && !hasInsufficientBalance && (
          <div className="text-xs text-red-500 text-center">
            {sendError.message.split("\n")[0]}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-purple-100 p-3 rounded-lg border border-purple-200">
            <div className="opacity-60 text-xs">Next Price (Approx)</div>
            <div className="font-bold">{formatDonut(nextPrice)} DONUT</div>
          </div>
          <div className="bg-purple-100 p-3 rounded-lg border border-purple-200">
            <div className="opacity-60 text-xs">Emission Rate</div>
            <div className="font-bold">{formatDonut(dps)} Donuette/sec</div>
          </div>
        </div>
      </Card>

      <div className="bg-white/50 p-4 rounded-xl text-xs space-y-3 border border-foreground/10">
        <div className="space-y-2">
          <h4 className="font-bold text-purple-900">Current Epoch</h4>
          <div className="flex items-center justify-between">
            <span className="opacity-60">Current King glazer:</span>
            <span className="font-semibold">
              {minerUsername ? (
                <span className="text-purple-700">@{minerUsername}</span>
              ) : currentMiner ? (
                <span className="font-mono text-xs">
                  {currentMiner.slice(0, 6)}...{currentMiner.slice(-4)}
                </span>
              ) : (
                "—"
              )}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="opacity-60">Time Held:</span>
            <span className="font-semibold">
              {timeElapsed > 0
                ? `${Math.floor(timeElapsed / 60)}m ${timeElapsed % 60}s`
                : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="opacity-60">Epoch ID:</span>
            <span className="font-semibold">#{slot0?.epochId || 0}</span>
          </div>
        </div>

        <div className="border-t border-foreground/10 pt-3 space-y-2">
          <h4 className="font-bold flex items-center gap-2 text-purple-900">
            <Zap className="w-3 h-3" />
            How It Works
          </h4>
          <p>• Price drops over time (Dutch Auction).</p>
          <p>• Mining doubles the price for the next miner.</p>
          <p>• 80% of DONUT spent goes to the previous miner.</p>
          <p>• 10% to Treasury, 10% to Provider.</p>
        </div>
      </div>
    </div>
  );
}
