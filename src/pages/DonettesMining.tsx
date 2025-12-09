import { Gem, CheckCircle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import {
  useAccount,
  useReadContract,
  useSendCalls,
  useCallsStatus,
} from "wagmi";
import {
  Address,
  formatEther,
  parseEther,
  encodeFunctionData,
  erc20Abi,
} from "viem";
import {
  DonuetteV2Address,
  DonuetteV2ABI,
  DonuetteTokenAddress,
} from "./constant";
import { useEffect, useState } from "react";
import snapshotData from "../data/snapshot.json";

// Define snapshot type
type SnapshotEntry = {
  address: string;
  balance: string;
  proof: string[];
};

export function DonettesMining() {
  const { address } = useAccount();
  const { sendCalls, data: callsId } = useSendCalls();

  const { data: callsStatus } = useCallsStatus({
    id: callsId?.id as string,
    query: {
      enabled: !!callsId,
      refetchInterval: (data) =>
        data.state.status === "success" ? false : 1000,
    },
  });

  const isConfirmed = callsStatus?.status === "success";

  // Check if user is in snapshot
  const [userEntry, setUserEntry] = useState<SnapshotEntry | null>(null);

  useEffect(() => {
    if (address) {
      const entry = (snapshotData as SnapshotEntry[]).find(
        (e) => e.address.toLowerCase() === address.toLowerCase()
      );
      setUserEntry(entry || null);
    }
  }, [address]);

  // Check how much user has already claimed
  const { data: amountClaimed, refetch: refetchClaimStatus } = useReadContract({
    address: DonuetteV2Address,
    abi: DonuetteV2ABI,
    functionName: "amountClaimed",
    args: [address as Address],
    query: {
      enabled: !!address,
    },
  });

  // Fetch current balance of OLD token
  const { data: currentBalance, refetch: refetchBalance } = useReadContract({
    address: DonuetteTokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address as Address],
    query: {
      enabled: !!address,
    },
  });

  useEffect(() => {
    if (isConfirmed) {
      refetchClaimStatus();
      refetchBalance();
      setClaimAmount(""); // Reset input after successful claim
    }
  }, [isConfirmed, refetchClaimStatus, refetchBalance]);

  const [claimAmount, setClaimAmount] = useState("");

  const getMaxClaimable = () => {
    if (!userEntry || !currentBalance) return 0n;
    const totalAllocation = BigInt(userEntry.balance);
    const claimedSoFar = amountClaimed ? BigInt(amountClaimed) : 0n;
    const remainingAllocation = totalAllocation - claimedSoFar;

    return currentBalance < remainingAllocation
      ? currentBalance
      : remainingAllocation;
  };

  const handlePercentage = (percent: number) => {
    const max = getMaxClaimable();
    if (max === 0n) return;

    if (percent === 100) {
      setClaimAmount(formatEther(max));
    } else {
      const amount = (max * BigInt(percent)) / 100n;
      setClaimAmount(formatEther(amount));
    }
  };

  const handleClaim = () => {
    if (!userEntry || !claimAmount) return;

    try {
      const amountToClaim = parseEther(claimAmount);
      if (amountToClaim <= 0n) return;

      const totalAllocation = BigInt(userEntry.balance);

      // 1. Approve Call
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [DonuetteV2Address, amountToClaim],
      });

      // 2. Claim Call
      const claimData = encodeFunctionData({
        abi: DonuetteV2ABI,
        functionName: "claim",
        args: [
          amountToClaim,
          totalAllocation,
          userEntry.proof as `0x${string}`[],
        ],
      });

      // Send both calls in a single batch
      sendCalls({
        calls: [
          {
            to: DonuetteTokenAddress, // Old Token Contract
            data: approveData,
          },
          {
            to: DonuetteV2Address, // New Token Contract
            data: claimData,
          },
        ],
      });
    } catch (e) {
      console.error("Invalid amount", e);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <h2 className="text-2xl font-bold flex items-center justify-center gap-2 text-purple-700">
          <Gem className="w-6 h-6" />
          Donuette V2 Migration
        </h2>
        <p className="text-sm opacity-80">
          Claim your new Donuette V2 tokens based on the snapshot.
        </p>
      </motion.div>

      <div className="bg-white border border-purple-100 rounded-xl p-6 space-y-6 shadow-sm">
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900">Migration Status</h3>

          {!address ? (
            <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
              Please connect your wallet to check eligibility.
            </div>
          ) : !userEntry ? (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>
                You are not eligible for this airdrop. Your address was not
                found in the snapshot.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-xs text-purple-600 uppercase font-bold">
                    Snapshot Amount
                  </p>
                  <p className="text-xl font-bold text-purple-900">
                    {parseFloat(
                      formatEther(BigInt(userEntry.balance))
                    ).toLocaleString()}{" "}
                    DonuetteV2
                  </p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 uppercase font-bold">
                    Current Wallet Balance
                  </p>
                  <p className="text-xl font-bold text-blue-900">
                    {currentBalance
                      ? parseFloat(formatEther(currentBalance)).toLocaleString()
                      : "0"}{" "}
                    OLD
                  </p>
                </div>
              </div>

              {currentBalance !== undefined &&
                BigInt(userEntry.balance) > currentBalance &&
                (amountClaimed === undefined ||
                  BigInt(amountClaimed) < BigInt(userEntry.balance)) && (
                  <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Partial Claim Available</p>
                      <p className="text-sm">
                        Your current wallet balance is lower than your total
                        snapshot allocation. You can claim what you currently
                        hold, and claim the rest later when you acquire more
                        tokens.
                      </p>
                    </div>
                  </div>
                )}

              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-gray-600 uppercase font-bold">
                    Migration Progress
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    {amountClaimed
                      ? parseFloat(formatEther(amountClaimed)).toLocaleString()
                      : "0"}{" "}
                    /{" "}
                    {parseFloat(
                      formatEther(BigInt(userEntry.balance))
                    ).toLocaleString()}{" "}
                    DNTV2
                  </p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-purple-600 h-2.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        amountClaimed
                          ? Math.min(
                              (Number(amountClaimed) * 100) /
                                Number(userEntry.balance),
                              100
                            )
                          : 0
                      }%`,
                    }}
                  ></div>
                </div>
              </div>

              {amountClaimed &&
              BigInt(amountClaimed) >= BigInt(userEntry.balance) ? (
                <div className="p-4 bg-green-50 text-green-700 rounded-lg flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <p>
                    You have successfully claimed all your Donuette V2 tokens!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={claimAmount}
                      onChange={(e) => setClaimAmount(e.target.value)}
                      placeholder="Amount to claim"
                      className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    />
                    <button
                      onClick={() => handlePercentage(100)}
                      className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-bold hover:bg-purple-200 transition-colors"
                    >
                      Max
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {[25, 50, 75].map((percent) => (
                      <button
                        key={percent}
                        onClick={() => handlePercentage(percent)}
                        className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                      >
                        {percent}%
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleClaim}
                    disabled={!claimAmount || parseFloat(claimAmount) <= 0}
                    className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors shadow-lg shadow-purple-200"
                  >
                    Claim Tokens
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-gray-100">
          <h4 className="text-sm font-bold text-gray-700 mb-2">
            Migration Details
          </h4>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>Snapshot taken at block 39250393</li>
            <li>1:1 exchange rate from V1 to V2</li>
            <li>
              Contract:{" "}
              <a
                href={`https://basescan.org/address/${DonuetteV2Address}`}
                target="_blank"
                rel="noreferrer"
                className="text-purple-600 hover:underline truncate"
              >
                {DonuetteV2Address.slice(0, 6)}...{DonuetteV2Address.slice(-4)}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
