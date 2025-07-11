import { transformDescriptionToSearchParams, FeedSearchParams } from "./gemini";
import { generateCustomFeed } from "./bluesky";

export interface CustomFeed {
  id: string;
  name: string;
  description: string;
  searchParams: FeedSearchParams;
  posts: any[];
  createdAt: Date;
  lastUpdated: Date;
  // Track shown posts for deduplication
  shownPostUris: Set<string>;
  // Track total fetched posts for progressive loading
  totalFetched: number;
  // Last search timestamp for rate limiting
  lastSearchTime: number;
  // Cached post pool for quality filtering
  cachedPostPool: any[];
  // Timestamp when the post pool was last filled
  poolCacheTimestamp: number;
  // Quality scores for posts in the pool
  postQualityScores: Map<string, number>;
}

export interface FeedTemplate {
  id: string;
  name: string;
  description: string;
  examples: string[];
  searchParams: FeedSearchParams;
}

// Pre-built templates for common feed types
export const FEED_TEMPLATES: FeedTemplate[] = [
  {
    id: "tech-news",
    name: "Tech News",
    description: "Latest technology and startup news",
    examples: ["latest tech news", "technology updates", "startup news"],
    searchParams: {
      keywords: [
        "technology",
        "tech",
        "startup",
        "innovation",
        "AI",
        "software",
      ],
      contentTypes: ["news"],
      searchStrategies: ["hashtags", "keywords"],
      hashtags: ["tech", "technology", "startup", "innovation", "AI"],
      userTypes: ["journalists", "tech"],
      requiresMedia: false,
    },
  },
  {
    id: "cat-content",
    name: "Cat Content",
    description: "Adorable cats and feline content",
    examples: ["cat pictures", "cute cats", "cat videos"],
    searchParams: {
      keywords: ["cat", "cats", "kitten", "feline", "meow"],
      contentTypes: ["photos", "animals"],
      searchStrategies: ["hashtags", "keywords"],
      hashtags: ["cats", "cat", "kitten", "pets", "animals"],
      userTypes: ["photographers"],
      requiresMedia: true,
      mediaType: "images",
    },
  },
  {
    id: "digital-art",
    name: "Digital Art",
    description: "Digital artwork and illustrations",
    examples: ["digital art", "illustrations", "concept art"],
    searchParams: {
      keywords: ["digital art", "illustration", "art", "design", "drawing"],
      contentTypes: ["art", "photos"],
      searchStrategies: ["hashtags", "keywords"],
      hashtags: ["digitalart", "art", "illustration", "design", "artwork"],
      userTypes: ["artists"],
      requiresMedia: true,
      mediaType: "images",
    },
  },
  {
    id: "memes",
    name: "Memes",
    description: "Funny memes and humor",
    examples: ["funny memes", "humor", "comedy posts"],
    searchParams: {
      keywords: ["memes", "meme", "funny", "humor", "comedy"],
      contentTypes: ["memes", "photos"],
      searchStrategies: ["hashtags", "trending"],
      hashtags: ["memes", "funny", "humor", "comedy"],
      userTypes: [],
      requiresMedia: false,
    },
  },
  {
    id: "wildlife",
    name: "Wildlife",
    description: "Wildlife photography and nature",
    examples: ["wildlife photos", "nature photography", "animal pictures"],
    searchParams: {
      keywords: ["wildlife", "nature", "animals", "photography", "birds"],
      contentTypes: ["photos", "animals"],
      searchStrategies: ["hashtags", "keywords"],
      hashtags: ["wildlife", "nature", "animals", "photography", "birds"],
      userTypes: ["photographers"],
      requiresMedia: true,
      mediaType: "images",
    },
  },
];

class FeedFactoryService {
  private feeds: Map<string, CustomFeed> = new Map();
  // Global deduplication set across all feeds
  private globalShownPosts: Set<string> = new Set();

  async createFeedFromDescription(
    description: string,
    name?: string,
  ): Promise<CustomFeed> {
    try {
      // Check if description matches a template
      const template = this.findMatchingTemplate(description);

      let searchParams: FeedSearchParams;
      if (template) {
        console.log(`Using template: ${template.name}`);
        searchParams = template.searchParams;
      } else {
        // Use Gemini to transform description
        searchParams = await transformDescriptionToSearchParams(description);
      }

      // Generate the feed using Bluesky search with larger initial batch
      const posts = await generateCustomFeed(
        searchParams.keywords,
        searchParams.contentTypes,
        searchParams.hashtags,
        searchParams.requiresMedia,
        searchParams.mediaType,
        100, // Increased from 30 to 100 for better pagination
        description, // Pass original description for Gemini relevance filtering
      );

      const feed: CustomFeed = {
        id: this.generateFeedId(),
        name: name || this.generateFeedName(description),
        description,
        searchParams,
        posts,
        createdAt: new Date(),
        lastUpdated: new Date(),
        shownPostUris: new Set<string>(),
        totalFetched: posts.length,
        lastSearchTime: Date.now(),
        cachedPostPool: posts,
        poolCacheTimestamp: Date.now(),
        postQualityScores: this.calculateQualityScores(posts),
      };

      this.feeds.set(feed.id, feed);
      return feed;
    } catch (error) {
      console.error("Error creating feed:", error);
      throw new Error("Failed to create custom feed");
    }
  }

  async refreshFeed(feedId: string): Promise<CustomFeed | null> {
    const feed = this.feeds.get(feedId);
    if (!feed) return null;

    try {
      const posts = await generateCustomFeed(
        feed.searchParams.keywords,
        feed.searchParams.contentTypes,
        feed.searchParams.hashtags,
        feed.searchParams.requiresMedia,
        feed.searchParams.mediaType,
        100, // Increased for better refresh
        feed.description, // Pass original description for Gemini relevance filtering
      );

      // Reset shown posts and update feed with new cached pool
      feed.shownPostUris.clear();
      feed.posts = posts;
      feed.totalFetched = posts.length;
      feed.lastUpdated = new Date();
      feed.lastSearchTime = Date.now();
      feed.cachedPostPool = posts;
      feed.poolCacheTimestamp = Date.now();
      feed.postQualityScores = this.calculateQualityScores(posts);

      return feed;
    } catch (error) {
      console.error("Error refreshing feed:", error);
      throw new Error("Failed to refresh feed");
    }
  }

  getFeed(feedId: string): CustomFeed | null {
    return this.feeds.get(feedId) || null;
  }

  async getFeedPaginated(
    feedId: string,
    cursor?: string,
    limit = 10,
  ): Promise<{ posts: any[]; cursor?: string }> {
    const feed = this.feeds.get(feedId);
    if (!feed) {
      throw new Error("Feed not found");
    }

    // Check if we need to refill the post pool
    await this.ensurePostPoolFilled(feed);

    // Get the top quality unviewed posts from the cached pool
    const qualityFilteredPosts = this.getTopQualityUnviewedPosts(feed, limit);

    // Mark these posts as shown
    qualityFilteredPosts.forEach((post) => {
      feed.shownPostUris.add(post.uri);
      this.globalShownPosts.add(post.uri);
    });

    // Transform posts to match Bluesky feed format expected by carousel
    const transformedPosts = qualityFilteredPosts.map((post) => ({
      post: {
        uri: post.uri,
        author: post.author,
        record: {
          text: post.record?.text || "",
          createdAt: post.record?.createdAt || post.indexedAt,
        },
        likeCount: post.likeCount,
        replyCount: post.replyCount,
        repostCount: post.repostCount,
        labels: post.labels,
        embed: post.embed,
      },
      searchTerm: post.searchTerm,
    }));

    const hasMore = this.hasMoreQualityPosts(feed);

    return {
      posts: transformedPosts,
      cursor: hasMore ? `custom_batch_${Date.now()}` : undefined,
    };
  }

  private async ensurePostPoolFilled(feed: CustomFeed): Promise<void> {
    const now = Date.now();
    const POOL_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
    const MIN_POOL_SIZE = 50; // Reduced from 100 to prevent frequent refills
    const MIN_REFILL_INTERVAL = 30 * 1000; // Minimum 30 seconds between refills

    // Check if enough time has passed since last refill to prevent rapid refilling
    const timeSinceLastRefill = now - feed.poolCacheTimestamp;
    if (timeSinceLastRefill < MIN_REFILL_INTERVAL) {
      return; // Skip refill if we just did one recently
    }

    // Get the number of unviewed posts to make better refill decisions
    const unviewedPosts = feed.cachedPostPool ? 
      feed.cachedPostPool.filter(post => !feed.shownPostUris.has(post.uri)).length : 0;

    // Check if we need to refill the pool
    const needsRefill =
      !feed.cachedPostPool ||
      unviewedPosts < 10 || // Only refill when we're running low on unviewed posts
      now - feed.poolCacheTimestamp > POOL_CACHE_TTL;

    if (needsRefill) {
      console.log(`🔄 Refilling post pool for feed "${feed.name}" (${unviewedPosts} unviewed posts remaining)...`);

      try {
        // Fetch a large batch of posts and cache them
        const posts = await generateCustomFeed(
          feed.searchParams.keywords,
          feed.searchParams.contentTypes,
          feed.searchParams.hashtags,
          feed.searchParams.requiresMedia,
          feed.searchParams.mediaType,
          150, // Reduced from 200 to be more conservative
          feed.description,
        );

        // Cache the posts and calculate quality scores
        feed.cachedPostPool = posts;
        feed.poolCacheTimestamp = now;
        feed.postQualityScores = this.calculateQualityScores(posts);

        console.log(
          `✅ Cached ${posts.length} posts in pool with quality scores`,
        );
      } catch (error) {
        console.error(`Failed to refill post pool for feed "${feed.name}":`, error);
        // Update timestamp anyway to prevent immediate retry
        feed.poolCacheTimestamp = now;
      }
    }
  }

  private calculateQualityScores(posts: any[]): Map<string, number> {
    const scores = new Map<string, number>();

    posts.forEach((post) => {
      const likes = post.likeCount || 0;
      const replies = post.replyCount || 0;
      const reposts = post.repostCount || 0;
      const followers = post.author?.followersCount || 0;

      // Base engagement score
      let score = likes + replies * 2 + reposts * 1.5;

      // Author quality bonus
      if (followers >= 100) {
        score += 25;
      } else if (followers >= 10) {
        score += 10;
      }

      // High engagement bonus
      if (replies >= 3 && likes >= 5) {
        score += 50;
      } else if (replies >= 2 && likes >= 3) {
        score += 20;
      }

      // Media bonus
      if (post.embed?.images?.length || post.embed?.video) {
        score += 15;
      }

      // Recency factor (favor posts 1-3 days old)
      const age = Date.now() - new Date(post.indexedAt).getTime();
      const ageDays = age / (1000 * 60 * 60 * 24);
      if (ageDays >= 0.7 && ageDays <= 3) {
        score += 20;
      } else if (ageDays <= 7) {
        score += 10;
      }

      scores.set(post.uri, score);
    });

    return scores;
  }

  private getTopQualityUnviewedPosts(feed: CustomFeed, limit: number): any[] {
    if (!feed.cachedPostPool) {
      return [];
    }

    // Filter unviewed posts
    const unviewedPosts = feed.cachedPostPool.filter(
      (post) => !feed.shownPostUris.has(post.uri),
    );

    // Sort by quality score (highest first)
    const sortedPosts = unviewedPosts.sort((a, b) => {
      const scoreA = feed.postQualityScores.get(a.uri) || 0;
      const scoreB = feed.postQualityScores.get(b.uri) || 0;
      return scoreB - scoreA;
    });

    // Return top N posts
    return sortedPosts.slice(0, limit);
  }

  private hasMoreQualityPosts(feed: CustomFeed): boolean {
    if (!feed.cachedPostPool) {
      return false;
    }

    // Check if there are any unviewed posts left in the pool
    const unviewedCount = feed.cachedPostPool.filter(
      (post) => !feed.shownPostUris.has(post.uri),
    ).length;

    return unviewedCount > 0;
  }

  getAllFeeds(): CustomFeed[] {
    return Array.from(this.feeds.values());
  }

  deleteFeed(feedId: string): boolean {
    const feed = this.feeds.get(feedId);
    if (feed) {
      // Remove posts from global shown set when deleting feed
      feed.shownPostUris.forEach((uri) => this.globalShownPosts.delete(uri));
    }
    return this.feeds.delete(feedId);
  }

  // Reset shown posts for a feed (useful for testing or user preference)
  resetFeedProgress(feedId: string): boolean {
    const feed = this.feeds.get(feedId);
    if (!feed) return false;

    // Remove from global set
    feed.shownPostUris.forEach((uri) => this.globalShownPosts.delete(uri));
    // Clear feed's shown set
    feed.shownPostUris.clear();

    return true;
  }

  // Get feed statistics
  getFeedStats(
    feedId: string,
  ): { totalPosts: number; shownPosts: number; availablePosts: number } | null {
    const feed = this.feeds.get(feedId);
    if (!feed) return null;

    const totalPosts = feed.posts.length;
    const shownPosts = feed.shownPostUris.size;
    const availablePosts = totalPosts - shownPosts;

    return { totalPosts, shownPosts, availablePosts };
  }

  getTemplates(): FeedTemplate[] {
    return FEED_TEMPLATES;
  }

  private findMatchingTemplate(description: string): FeedTemplate | null {
    const lowerDesc = description.toLowerCase();

    return (
      FEED_TEMPLATES.find((template) =>
        template.examples.some(
          (example) =>
            example.toLowerCase().includes(lowerDesc) ||
            lowerDesc.includes(example.toLowerCase()),
        ),
      ) || null
    );
  }

  private generateFeedId(): string {
    return `feed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFeedName(description: string): string {
    // Capitalize first letter and limit length
    const name = description.charAt(0).toUpperCase() + description.slice(1);
    return name.length > 30 ? name.substring(0, 27) + "..." : name;
  }

  // Save/load feeds to localStorage
  saveToStorage(): void {
    try {
      const feedsArray = Array.from(this.feeds.entries());
      localStorage.setItem("custom_feeds", JSON.stringify(feedsArray));
    } catch (error) {
      console.warn("Failed to save feeds to storage:", error);
    }
  }

  loadFromStorage(): void {
    try {
      const stored = localStorage.getItem("custom_feeds");
      if (stored) {
        const feedsArray = JSON.parse(stored);
        this.feeds = new Map(
          feedsArray.map(([id, feed]: [string, any]) => [
            id,
            {
              ...feed,
              createdAt: new Date(feed.createdAt),
              lastUpdated: new Date(feed.lastUpdated),
              // Restore Sets from arrays (localStorage doesn't preserve Sets)
              shownPostUris: new Set(feed.shownPostUris || []),
              totalFetched: feed.totalFetched || feed.posts?.length || 0,
              lastSearchTime: feed.lastSearchTime || 0,
              // Initialize new caching fields if missing
              cachedPostPool: feed.cachedPostPool || feed.posts || [],
              poolCacheTimestamp: feed.poolCacheTimestamp || 0,
              postQualityScores: new Map(feed.postQualityScores || []),
            },
          ]),
        );
      }
    } catch (error) {
      console.warn("Failed to load feeds from storage:", error);
    }
  }
}

// Export singleton instance
export const feedFactory = new FeedFactoryService();
