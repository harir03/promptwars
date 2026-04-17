import { useState, useEffect } from "react";
import type { RewardOffer } from "@/types";
import { Gift, Clock, Star, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface RewardsWalletProps {
  userId?: string;
}

/**
 * Rewards Wallet — shows active offers and user points.
 * Fetches from /api/rewards and /api/rewards/{userId}.
 */
export function RewardsWallet({ userId = "demo_user" }: RewardsWalletProps) {
  const [points, setPoints] = useState(0);
  const [offers, setOffers] = useState<RewardOffer[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);

  // Poll active offers every 10s
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user wallet
        const walletRes = await fetch(`/api/rewards/${userId}`);
        if (walletRes.ok) {
          const walletData = await walletRes.json();
          setPoints(walletData.points ?? 0);
        }
      } catch { /* ignore */ }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [userId]);

  const claimOffer = async (offerId: string) => {
    setClaiming(offerId);
    try {
      const res = await fetch("/api/rewards/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, offer_id: offerId }),
      });
      if (res.ok) {
        const data = await res.json();
        setPoints(data.points);
        // Remove claimed offer from display
        setOffers((prev) => prev.filter((o) => o.id !== offerId));
      }
    } catch { /* ignore */ }
    finally { setClaiming(null); }
  };

  return (
    <div className="sl-card p-4 bg-white">
      {/* Points Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
            <Star className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Rewards</h3>
            <p className="text-[10px] text-slate-400">Earn points for smart choices</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xl font-black text-slate-900">{points}</span>
          <span className="text-[10px] font-bold text-slate-400 ml-1">pts</span>
        </div>
      </div>

      {/* Active Offers */}
      {offers.length > 0 ? (
        <div className="space-y-2">
          <AnimatePresence>
            {offers.map((offer) => (
              <motion.div
                key={offer.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-teal-50 border border-teal-100 rounded-lg px-3 py-2.5 flex items-center gap-2"
              >
                <Gift className="w-4 h-4 text-teal-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{offer.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {offer.discount_percent > 0 && (
                      <span className="text-[9px] font-black text-teal-600 bg-teal-100 px-1.5 py-0.5 rounded">
                        {offer.discount_percent}% OFF
                      </span>
                    )}
                    {offer.points > 0 && (
                      <span className="text-[9px] font-bold text-amber-600">+{offer.points} pts</span>
                    )}
                    <span className="text-[9px] text-slate-400 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" /> {offer.remaining_minutes.toFixed(0)}m left
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => claimOffer(offer.id)}
                  disabled={claiming === offer.id}
                  className="px-2.5 py-1 rounded-md bg-teal-400 text-white text-[10px] font-bold hover:bg-teal-500 transition-colors disabled:opacity-50 shrink-0"
                >
                  {claiming === offer.id ? "..." : "Claim"}
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-4">
          <Gift className="w-6 h-6 text-slate-200 mx-auto mb-2" />
          <p className="text-xs text-slate-400">No active offers right now</p>
          <p className="text-[10px] text-slate-300 mt-0.5">Offers appear when zones are congested</p>
        </div>
      )}
    </div>
  );
}
