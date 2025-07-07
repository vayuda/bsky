import { useState, useEffect, useCallback, useRef } from "react";
import { BskyAgent } from "@atproto/api";

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

interface Post {
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
}

interface SessionStats {
  postsViewed: number;
  sessionStartTime: number;
  currentBatch: number;
  timeSpent: number;
}

interface UseCarouselFeedOptions {
  agent: BskyAgent | null;
  feedType: "following" | "discover" | "popular" | "custom";
  customFeedId?: string;
}

interface UseCarouselFeedReturn {
  posts: Post[];
  currentPostIndex: number;
  isLoading: boolean;
  error: string | null;
  sessionStats: SessionStats;
  nextPost: () => void;
  prevPost: () => void;
  loadNextBatch: () => Promise<void>;
  refresh: () => Promise<void>;
  isAtSessionSummary: boolean;
  isNetworkExhausted: boolean;
}

export const useCarouselFeed = ({
  agent,
  feedType,
  customFeedId,
}: UseCarouselFeedOptions): UseCarouselFeedReturn => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [isNetworkExhausted, setIsNetworkExhausted] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    postsViewed: 0,
    sessionStartTime: Date.now(),
    currentBatch: 0,
    timeSpent: 0,
  });
  
  // Track if we've initialized for the current feedType to prevent loops
  const initStateRef = useRef<{agent: BskyAgent | null, feedType: string} | null>(null);

  // Transform AT Protocol data to our format
  const transformPosts = useCallback((feedData: any[]): Post[] => {
    return feedData.map((item: any) => {
      const post = item.post || item; // Handle direct post objects vs feed items
      
      // Transform embed data
      let embed: PostEmbed | undefined;
      if (post.embed) {
        if (post.embed.$type === 'app.bsky.embed.images#view' && post.embed.images) {
          embed = {
            images: post.embed.images.map((img: any) => ({
              thumb: img.thumb,
              fullsize: img.fullsize,
              alt: img.alt || '',
              aspectRatio: img.aspectRatio,
            })),
          };
        } else if (post.embed.$type === 'app.bsky.embed.video#view' && post.embed.video) {
          embed = {
            video: {
              playlist: post.embed.video.playlist,
              thumbnail: post.embed.video.thumbnail,
              alt: post.embed.video.alt || '',
              aspectRatio: post.embed.video.aspectRatio,
            },
          };
        }
      }
      
      return {
        id: post.uri,
        author: {
          displayName: post.author.displayName || post.author.handle,
          handle: post.author.handle,
          avatar: post.author.avatar,
          verified:
            post.author.labels?.some(
              (label: any) => label.val === "verified",
            ) || false,
        },
        text: post.record.text,
        createdAt: post.record.createdAt,
        likeCount: post.likeCount || 0,
        replyCount: post.replyCount || 0,
        repostCount: post.repostCount || 0,
        isLiked: !!post.viewer?.like,
        isReposted: !!post.viewer?.repost,
        labels: post.labels?.map((label: any) => label.val) || [],
        embed,
        networkContext: item.networkContext,
      };
    });
  }, []);

  // Load posts from API
  const loadPosts = useCallback(
    async (isRefresh = false): Promise<Post[]> => {
      if (!agent) throw new Error("No agent available");

      let response;
      const limit = 10;

      switch (feedType) {
        case "discover":
          const discoverResult = await (
            await import("../services/bluesky")
          ).getFollowersOfFollowersFeed(isRefresh ? undefined : cursor, limit, isRefresh);
          response = {
            data: {
              feed: discoverResult.feed,
              cursor: discoverResult.cursor,
            },
          };
          break;
        case "popular":
          response = await agent.app.bsky.feed.getFeed({
            feed: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/bsky-team",
            limit,
            cursor: isRefresh ? undefined : cursor,
          });
          break;
        case "custom":
          if (!customFeedId) throw new Error("Custom feed ID required");
          const customResult = await (
            await import("../services/feedFactory")
          ).feedFactory.getFeedPaginated(customFeedId, isRefresh ? undefined : cursor, limit);
          response = {
            data: {
              feed: customResult.posts,
              cursor: customResult.cursor,
            },
          };
          break;
        case "following":
        default:
          response = await agent.getTimeline({
            limit,
            cursor: isRefresh ? undefined : cursor,
          });
          break;
      }

      // Update cursor for pagination
      setCursor(response.data.cursor);
      
      // Check if network is exhausted (no more cursor means no more posts available)
      if (feedType === 'discover' && !response.data.cursor) {
        setIsNetworkExhausted(true);
      } else if (feedType === 'discover' && response.data.cursor) {
        setIsNetworkExhausted(false);
      }

      return transformPosts(response.data.feed);
    },
    [agent, feedType, customFeedId, cursor, transformPosts],
  );

  // Navigate to next post
  const nextPost = useCallback(() => {
    if (currentPostIndex < posts.length) {
      setCurrentPostIndex((prev) => prev + 1);
      setSessionStats((prev) => ({
        ...prev,
        postsViewed: prev.postsViewed + 1,
        timeSpent: Date.now() - prev.sessionStartTime,
      }));
    }
  }, [currentPostIndex, posts.length]);

  const prevPost = useCallback(() => {
    if (currentPostIndex > 0) {
      setCurrentPostIndex((prev) => prev - 1);
      setSessionStats((prev) => ({
        ...prev,
        postsViewed: prev.postsViewed + 1,
        timeSpent: Date.now() - prev.sessionStartTime,
      }));
    }
  }, [currentPostIndex]);

  // Load next batch of posts
  const loadNextBatch = useCallback(async () => {
    if (isLoading || !agent) return;

    setIsLoading(true);
    setError(null);

    try {
      const newPosts = await loadPosts(false);
      setPosts(newPosts);
      setCurrentPostIndex(0);
      setSessionStats((prev) => ({
        ...prev,
        currentBatch: prev.currentBatch + 1,
        timeSpent: Date.now() - prev.sessionStartTime,
      }));
    } catch (err: any) {
      console.error("Failed to load next batch:", err);
      setError(err.message || "Failed to load next batch");
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, agent, loadPosts]);

  // Refresh feed (reset posts but preserve session time)
  const refresh = useCallback(async () => {
    if (!agent) return;

    setIsLoading(true);
    setError(null);
    setCursor(undefined);
    setCurrentPostIndex(0);
    setIsNetworkExhausted(false);
    
    // Preserve session start time on manual refresh, only reset batch count
    setSessionStats(prev => ({
      postsViewed: 0,
      sessionStartTime: prev.sessionStartTime, // Keep original session start
      currentBatch: 0,
      timeSpent: Date.now() - prev.sessionStartTime, // Update time spent
    }));

    try {
      const newPosts = await loadPosts(true);
      setPosts(newPosts);
    } catch (err: any) {
      console.error("Failed to refresh feed:", err);
      setError(err.message || "Failed to refresh feed");
    } finally {
      setIsLoading(false);
    }
  }, [agent, loadPosts]);

  // Check if we're at the session summary (after viewing all posts in batch)
  const isAtSessionSummary =
    currentPostIndex >= posts.length && posts.length > 0;

  // Initial load when feedType or agent changes
  useEffect(() => {
    const currentState = { agent, feedType };
    const needsInit = !initStateRef.current || 
                     initStateRef.current.agent !== agent || 
                     initStateRef.current.feedType !== feedType;
    
    if (agent && needsInit) {
      console.log(`🚀 Initializing feed: ${feedType}`);
      initStateRef.current = currentState;
      
      // Call refresh directly without depending on it
      setIsLoading(true);
      setError(null);
      setCursor(undefined);
      setCurrentPostIndex(0);
      setIsNetworkExhausted(false);
      setSessionStats({
        postsViewed: 0,
        sessionStartTime: Date.now(), // Only reset timer on feed change
        currentBatch: 0,
        timeSpent: 0,
      });

      loadPosts(true).then((newPosts) => {
        setPosts(newPosts);
        setIsLoading(false);
      }).catch((err: any) => {
        console.error("Failed to initialize feed:", err);
        setError(err.message || "Failed to load feed");
        setIsLoading(false);
      });
    }
  }, [agent, feedType, loadPosts]);

  // Update time spent every second
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionStats((prev) => ({
        ...prev,
        timeSpent: Date.now() - prev.sessionStartTime,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    posts,
    currentPostIndex,
    isLoading,
    error,
    sessionStats,
    prevPost,
    nextPost,
    loadNextBatch,
    refresh,
    isAtSessionSummary,
    isNetworkExhausted,
  };
};
