import { useState, useEffect, useRef, useCallback } from "react";
import { BskyAgent } from "@atproto/api";

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
  networkContext?: {
    via: string;
    weight: number;
  };
}

interface UseVirtualFeedOptions {
  agent: BskyAgent | null;
  feedType: "following" | "discover" | "popular";
  visibleThreshold?: number; // How many posts to keep visible
  loadThreshold?: number; // When to load more (posts from bottom)
}

interface UseVirtualFeedReturn {
  visiblePosts: Post[];
  isLoading: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  registerPostElement: (id: string, element: HTMLElement | null) => void;
}

export const useVirtualFeed = ({
  agent,
  feedType,
  visibleThreshold = 20,
  loadThreshold = 5,
}: UseVirtualFeedOptions): UseVirtualFeedReturn => {
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [visiblePosts, setVisiblePosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  // Track which posts are actually visible on screen
  const visiblePostIds = useRef<Set<string>>(new Set());
  const postElements = useRef<Map<string, HTMLElement>>(new Map());
  const intersectionObserver = useRef<IntersectionObserver | null>(null);

  // Transform AT Protocol data to our format
  const transformPosts = useCallback((feedData: any[]): Post[] => {
    return feedData.map((item: any) => ({
      id: item.post.uri,
      author: {
        displayName: item.post.author.displayName || item.post.author.handle,
        handle: item.post.author.handle,
        avatar: item.post.author.avatar,
        verified:
          item.post.author.labels?.some(
            (label: any) => label.val === "verified",
          ) || false,
      },
      text: item.post.record.text,
      createdAt: item.post.record.createdAt,
      likeCount: item.post.likeCount || 0,
      replyCount: item.post.replyCount || 0,
      repostCount: item.post.repostCount || 0,
      isLiked: !!item.post.viewer?.like,
      isReposted: !!item.post.viewer?.repost,
      labels: item.post.labels?.map((label: any) => label.val) || [],
      networkContext: item.networkContext,
    }));
  }, []);

  // Load posts from API
  const loadPosts = useCallback(
    async (isRefresh = false): Promise<Post[]> => {
      if (!agent) throw new Error("No agent available");

      let response;
      const limit = 10;

      switch (feedType) {
        case "discover":
          const discoverResult = await (await import("../services/bluesky")).getFollowersOfFollowersFeed(
            isRefresh ? undefined : cursor,
            limit
          );
          response = {
            data: {
              feed: discoverResult.feed,
              cursor: discoverResult.cursor
            }
          };
          break;
        case "popular":
          response = await agent.app.bsky.feed.getFeed({
            feed: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/bsky-team",
            limit,
            cursor: isRefresh ? undefined : cursor,
          });
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
      setHasMore(!!response.data.cursor);

      return transformPosts(response.data.feed);
    },
    [agent, feedType, cursor, transformPosts],
  );

  // Update the visible posts queue based on what's actually visible
  const updateVisibleQueue = useCallback(() => {
    const visibleIds = Array.from(visiblePostIds.current);

    // Find the range of posts that should be visible
    const firstVisibleIndex = allPosts.findIndex((post) =>
      visibleIds.includes(post.id),
    );
    const lastVisibleIndex = allPosts.reduceRight((lastIndex, post, index) => {
      if (lastIndex === -1 && visibleIds.includes(post.id)) {
        return index;
      }
      return lastIndex;
    }, -1);

    if (firstVisibleIndex !== -1 && lastVisibleIndex !== -1) {
      // Include buffer posts around visible area
      const bufferSize = Math.floor(visibleThreshold / 4);
      const startIndex = Math.max(0, firstVisibleIndex - bufferSize);
      const endIndex = Math.min(
        allPosts.length,
        lastVisibleIndex + bufferSize + 1,
      );

      const newVisiblePosts = allPosts.slice(startIndex, endIndex);

      // Only update if the visible posts have actually changed
      if (
        JSON.stringify(newVisiblePosts.map((p) => p.id)) !==
        JSON.stringify(visiblePosts.map((p) => p.id))
      ) {
        setVisiblePosts(newVisiblePosts);
      }
    }
  }, [allPosts, visiblePosts, visibleThreshold]);

  // Load more posts (for infinite scroll)
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore || !agent) return;

    setIsLoading(true);
    setError(null);

    try {
      const newPosts = await loadPosts(false);

      // Add new posts to the end of all posts
      setAllPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const uniqueNewPosts = newPosts.filter((p) => !existingIds.has(p.id));
        return [...prev, ...uniqueNewPosts];
      });
    } catch (err: any) {
      console.error("Failed to load more posts:", err);
      setError(err.message || "Failed to load more posts");
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, agent, loadPosts]);

  // Refresh feed (replace all posts)
  const refresh = useCallback(async () => {
    if (!agent) return;

    setIsLoading(true);
    setError(null);
    setCursor(undefined);
    setHasMore(true);

    try {
      const newPosts = await loadPosts(true);
      setAllPosts(newPosts);
      setVisiblePosts(
        newPosts.slice(0, Math.min(visibleThreshold, newPosts.length)),
      );

      // Clear visibility tracking
      visiblePostIds.current.clear();
    } catch (err: any) {
      console.error("Failed to refresh feed:", err);
      setError(err.message || "Failed to refresh feed");
    } finally {
      setIsLoading(false);
    }
  }, [agent, loadPosts, visibleThreshold]);

  // Register post elements for observation
  const registerPostElement = useCallback(
    (id: string, element: HTMLElement | null) => {
      const observer = intersectionObserver.current;
      if (!observer) return;

      // Remove old element if it exists
      const oldElement = postElements.current.get(id);
      if (oldElement) {
        observer.unobserve(oldElement);
        postElements.current.delete(id);
      }

      // Add new element
      if (element) {
        element.setAttribute("data-post-id", id);
        postElements.current.set(id, element);
        observer.observe(element);
      }
    },
    [],
  );

  // Initialize intersection observer
  useEffect(() => {
    intersectionObserver.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const postId = entry.target.getAttribute("data-post-id");
          if (!postId) return;

          if (entry.isIntersecting) {
            visiblePostIds.current.add(postId);
          } else {
            visiblePostIds.current.delete(postId);
          }
        });

        // Update visible posts queue
        updateVisibleQueue();

        // Check if we need to load more posts
        const visibleIds = Array.from(visiblePostIds.current);
        if (visibleIds.length > 0 && hasMore && !isLoading) {
          // Find the highest index of visible posts in the allPosts array
          const lastVisibleIndex = Math.max(
            ...visibleIds.map(id => allPosts.findIndex(post => post.id === id))
          );
          
          // Load more if we're within loadThreshold posts of the end
          if (lastVisibleIndex >= allPosts.length - loadThreshold) {
            loadMore();
          }
        }
      },
      {
        rootMargin: "100px", // Start loading when 100px away from viewport
        threshold: 0.1,
      },
    );

    return () => {
      if (intersectionObserver.current) {
        intersectionObserver.current.disconnect();
      }
    };
  }, [updateVisibleQueue, loadMore, hasMore, isLoading, visiblePosts.length, loadThreshold, allPosts]);

  // Initial load when feedType or agent changes
  useEffect(() => {
    if (agent) {
      refresh();
    }
  }, [agent, feedType, refresh]);

  // Update visible posts when allPosts changes
  useEffect(() => {
    if (allPosts.length > 0 && visiblePosts.length === 0) {
      setVisiblePosts(
        allPosts.slice(0, Math.min(visibleThreshold, allPosts.length)),
      );
    }
  }, [allPosts, visiblePosts.length, visibleThreshold]);

  return {
    visiblePosts,
    isLoading,
    hasMore,
    error,
    loadMore,
    refresh,
    registerPostElement,
  };
};