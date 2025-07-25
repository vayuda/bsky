import React from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Clock, Eye, BarChart3, ArrowRight } from "lucide-react";

interface SessionSummaryProps {
  postsViewed: number;
  timeSpent: number;
  currentBatch: number;
  onLoadNextBatch: () => void;
  isLoading: boolean;
  isNetworkExhausted: boolean;
  feedType: "following" | "discover" | "custom" | "factory";
}

export const SessionSummary: React.FC<SessionSummaryProps> = ({
  postsViewed,
  timeSpent,
  currentBatch,
  onLoadNextBatch,
  isLoading,
  isNetworkExhausted,
  feedType,
}) => {
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <Card className="border-x-0 border-t-0 border-b rounded-2xl bg-white">
      <CardContent className="p-6">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-beige rounded-full flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-red" />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Session Summary
            </h3>
            <p className="text-sm text-gray-600">
              You've completed batch {currentBatch + 1}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
            <div className="bg-white rounded-lg p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Eye className="w-5 h-5 text-red" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {postsViewed}
              </div>
              <div className="text-xs text-gray-500">Posts Viewed</div>
            </div>

            <div className="bg-white rounded-lg p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Clock className="w-5 h-5 text-red" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatTime(timeSpent)}
              </div>
              <div className="text-xs text-gray-500">Time Spent</div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-dark">
              Take a moment to reflect on what you've seen.
            </p>

            {isNetworkExhausted && feedType === "discover" ? (
              <div className="text-center space-y-3">
                <div className="bg-coffee/10 border border-coffee/30 rounded-lg p-3">
                  <p className="text-sm text-coffee">
                    🎉 You've explored your entire network! You've seen all
                    available posts from people in your 1-hop network.
                  </p>
                </div>
                <p className="text-xs text-coffee">
                  Follow more people or check back later for new content
                </p>
              </div>
            ) : (
              <Button
                onClick={onLoadNextBatch}
                disabled={isLoading}
                className="w-full bg-coffee hover:bg-dark text-beige"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-beige border-t-transparent rounded-full animate-spin mr-2"></div>
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    Load Next Batch
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
