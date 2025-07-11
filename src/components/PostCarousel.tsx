import React, { useEffect, useCallback } from "react";
import { Post } from "./Post";
import { SessionSummary } from "./SessionSummary";
import { ChevronRight, ArrowRight } from "lucide-react";

interface PostImage {
  thumb: string;
  fullsize: string;
  alt: string;
  aspectRatio?: {
    width: number;
    height: number;
  };
}

interface PostEmbed {
  images?: PostImage[];
  video?: {
    playlist: string;
    thumbnail?: string;
    alt?: string;
    aspectRatio?: {
      width: number;
      height: number;
    };
  };
}

interface PostCarouselProps {
  posts: Array<{
    id: string;
    author: {
      displayName: string;
      handle: string;
      avatar?: string;
      verified?: boolean;
    };
    text: string;
    createdAt: string;
    likeCount: number;
    replyCount: number;
    repostCount: number;
    isLiked: boolean;
    isReposted: boolean;
    labels: string[];
    embed?: PostEmbed;
    networkContext?: {
      via: string;
      weight: number;
    };
  }>;
  currentPostIndex: number;
  isAtSessionSummary: boolean;
  sessionStats: {
    postsViewed: number;
    timeSpent: number;
    currentBatch: number;
  };
  onNextPost: () => void;
  onPrevPost: () => void;
  onLoadNextBatch: () => void;
  isLoading: boolean;
  isNetworkExhausted: boolean;
  feedType: "following" | "discover" | "custom" | "factory";
}

export const PostCarousel: React.FC<PostCarouselProps> = ({
  posts,
  currentPostIndex,
  isAtSessionSummary,
  sessionStats,
  onPrevPost,
  onNextPost,
  onLoadNextBatch,
  isLoading,
  isNetworkExhausted,
  feedType,
}) => {
  // Handle keyboard navigation
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onNextPost();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        onPrevPost();
      }
    },
    [onNextPost, onPrevPost],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleKeyPress]);

  // Show session summary when we've viewed all posts
  if (isAtSessionSummary) {
    return (
      <div className="max-w-2xl mx-auto">
        <SessionSummary
          postsViewed={sessionStats.postsViewed}
          timeSpent={sessionStats.timeSpent}
          currentBatch={sessionStats.currentBatch}
          onLoadNextBatch={onLoadNextBatch}
          isLoading={isLoading}
          isNetworkExhausted={isNetworkExhausted}
          feedType={feedType}
        />
      </div>
    );
  }

  // Show current post
  const currentPost = posts[currentPostIndex];

  if (!currentPost) {
    return (
      <div className="p-8 text-center">
        <p className="text-coffee">No posts to display</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Rounded card container */}
      <div className="bg-milk rounded-2xl shadow-lg border border-mocha/20 overflow-hidden">
        {/* Progress indicator */}
        <div className="bg-beige/50 p-4 border-b border-mocha/20">
          {/* Progress bar */}
          <div className="w-full bg-mocha/20 rounded-full h-2">
            <div
              className="bg-red h-2 rounded-full transition-all duration-300"
              style={{
                width: `${((currentPostIndex + 1) / posts.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Current post */}
        <div className="relative">
          <Post
            id={currentPost.id}
            uri={currentPost.id}
            author={currentPost.author}
            text={currentPost.text}
            createdAt={currentPost.createdAt}
            likeCount={currentPost.likeCount}
            replyCount={currentPost.replyCount}
            repostCount={currentPost.repostCount}
            isLiked={currentPost.isLiked}
            isReposted={currentPost.isReposted}
            labels={currentPost.labels}
            embed={currentPost.embed}
            networkContext={currentPost.networkContext}
            isInCarousel={true}
          />
        </div>
      </div>
    </div>
  );
};
