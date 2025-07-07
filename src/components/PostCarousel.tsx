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
  feedType: 'following' | 'discover' | 'popular' | 'custom';
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
        <p className="text-gray-600">No posts to display</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress indicator */}
      <div className="bg-white border-b border-gray-200 p-4">
        {/* <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">
            Post {currentPostIndex + 1} of {posts.length}
          </span>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <ArrowRight className="w-4 h-4" />
            <span>Press → to continue</span>
          </div>
        </div> */}

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
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
        />

        {/* Navigation hint overlay */}
        {currentPostIndex < posts.length - 1 && (
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <div className="bg-blue-600 text-white p-2 rounded-full shadow-lg animate-pulse">
              <ChevronRight className="w-5 h-5" />
            </div>
          </div>
        )}
      </div>

      {/* Bottom navigation hint */}
      <div className="bg-gray-50 border-t border-gray-200 p-4">
        <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
          {currentPostIndex < posts.length - 1 ? (
            <>
              <ArrowRight className="w-4 h-4" />
              <span>Press the right arrow key to view the next post</span>
            </>
          ) : (
            <span>Press → to view your session summary</span>
          )}
        </div>
      </div>
    </div>
  );
};
