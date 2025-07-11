import { BskyAgent } from "@atproto/api";
import { GoogleGenerativeAI } from "@google/generative-ai";

const agent = new BskyAgent({
  service: "https://bsky.social",
});

export const loginToBluesky = async (identifier: string, password: string) => {
  await agent.login({ identifier, password });
  return agent;
};

export const getTimeline = async () => {
  const response = await agent.getTimeline();
  console.log(`✅ FOLLOWING FEED: Loaded ${response.data.feed.length} posts from followed users only`);
  return response.data.feed;
};

export const getDiscoverFeed = async () => {
  // Use following timeline for discover feed
  const response = await agent.getTimeline();
  return response.data.feed;
};


export const createPost = async (text: string) => {
  await agent.post({ text });
};

export const getPostThread = async (uri: string) => {
  try {
    const response = await agent.app.bsky.feed.getPostThread({
      uri,
      depth: 10,
    });
    return response.data.thread;
  } catch (error) {
    console.error("Error fetching post thread:", error);
    throw error;
  }
};

export const searchPosts = async (
  query: string,
  limit = 100,
  cursor?: string,
) => {
  try {
    const response = await agent.app.bsky.feed.searchPosts({
      q: query,
      limit,
      cursor,
    });

    return {
      posts: response.data.posts,
      cursor: response.data.cursor,
    };
  } catch (error) {
    console.error("Search error:", error);
    return { posts: [], cursor: undefined };
  }
};

// Enhanced author data fetching for high-engagement posts
const enrichPostsWithAuthorData = async (posts: any[]): Promise<any[]> => {
  // Only enrich posts that already show high engagement
  const highEngagementPosts = posts.filter(
    (post) => (post.replyCount || 0) >= 3 && (post.likeCount || 0) >= 5,
  );

  if (highEngagementPosts.length === 0) return posts;

  console.log(
    `Enriching ${highEngagementPosts.length} high-engagement posts with author data...`,
  );

  // Fetch author profiles in small batches to avoid rate limiting
  const batchSize = 3;
  for (
    let i = 0;
    i < Math.min(highEngagementPosts.length, 10);
    i += batchSize
  ) {
    const batch = highEngagementPosts.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (post) => {
        try {
          const profile = await agent.app.bsky.actor.getProfile({
            actor: post.author.did,
          });

          // Add follower count to author data
          post.author.followersCount = profile.data.followersCount || 0;
        } catch (error) {
          console.warn(
            `Failed to fetch profile for ${post.author.handle}:`,
            error,
          );
          post.author.followersCount = 0;
        }
      }),
    );

    // Rate limiting delay
    if (i + batchSize < highEngagementPosts.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return posts;
};

// Age filtering function - keep posts between 16 hours and 3 days old
const filterPostsByAge = (posts: any[]) => {
  const now = new Date().getTime();
  const sixteenHoursAgo = now - 16 * 60 * 60 * 1000; // 16 hours
  const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000; // 3 days

  return posts.filter((post) => {
    const postTime = new Date(post.indexedAt).getTime();
    return postTime <= sixteenHoursAgo && postTime >= threeDaysAgo;
  });
};

// Quality filtering function with engagement-based prioritization
const filterQualityPosts = (
  posts: any[],
  requiresMedia = false,
  mediaType?: "images" | "videos" | "any",
) => {
  return posts.filter((post) => {
    const text = post.record?.text || "";

    // Basic quality filters
    if (text.length < 10) return false; // Too short

    // Hashtag spam detection
    const hashtagCount = (text.match(/#\w+/g) || []).length;
    const wordCount = text.split(/\s+/).length;
    if (hashtagCount > wordCount * 0.4) return false; // >40% hashtags

    // Media requirements
    if (requiresMedia) {
      const hasMedia = post.embed?.images?.length > 0 || post.embed?.video;
      if (!hasMedia) return false;

      // Specific media type filtering
      if (mediaType === "images" && !post.embed?.images?.length) return false;
      if (mediaType === "videos" && !post.embed?.video) return false;
    }

    // Minimum engagement threshold - allow low engagement for media posts
    const replyCount = post.replyCount || 0;
    const likeCount = post.likeCount || 0;
    const totalEngagement = likeCount + replyCount + (post.repostCount || 0);

    // If it has media, allow lower engagement threshold
    if (requiresMedia && totalEngagement >= 1) return true;

    // For non-media posts, require some minimal engagement
    if (totalEngagement === 0) return false;

    return true;
  });
};

// Gemini relevance filtering for final post selection
const filterPostsWithGemini = async (
  posts: any[],
  originalDescription: string,
  keywords: string[],
): Promise<any[]> => {
  if (posts.length <= 20) {
    console.log(
      "📝 Skipping Gemini filtering - already have 20 or fewer posts",
    );
    return posts;
  }

  try {
    const genAI = new GoogleGenerativeAI(
      process.env.REACT_APP_GEMINI_API_KEY || "",
    );
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite-preview-06-17",
    });

    // Prepare posts data for Gemini
    const postsData = posts.slice(0, 50).map((post, index) => ({
      id: index,
      text: post.record?.text || "",
      author: post.author?.displayName || post.author?.handle || "Unknown",
      likes: post.likeCount || 0,
      replies: post.replyCount || 0,
      hasMedia: !!(post.embed?.images?.length || post.embed?.video),
    }));

    const prompt = `
      You are reviewing social media posts for relevance to a user's feed request.

      Original request: "${originalDescription}"
      Keywords: ${keywords.join(", ")}

      Review these ${postsData.length} posts and select the TOP 20 most relevant ones.
      Consider: content relevance, quality, engagement, and how well they match the user's intent.

      Posts to review:
      ${postsData.map((p) => `${p.id}: "${p.text}" (by ${p.author}, ${p.likes} likes, ${p.replies} replies, media: ${p.hasMedia})`).join("\n")}

      Return ONLY a JSON array of the IDs of the 20 most relevant posts, ordered by relevance (best first).
      Example: [5, 12, 3, 18, 9, ...]
      `;

    console.log("🤖 Asking Gemini to review post relevance...");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse response
    const cleanText = text.replace(/```json\s*|\s*```/g, "").trim();
    const selectedIds = JSON.parse(cleanText);

    if (Array.isArray(selectedIds)) {
      const selectedPosts = selectedIds
        .filter((id) => id >= 0 && id < posts.length)
        .map((id) => posts[id])
        .filter(Boolean);

      console.log(
        `✅ Gemini selected ${selectedPosts.length} most relevant posts`,
      );
      return selectedPosts;
    }
  } catch (error) {
    console.warn("Failed to filter posts with Gemini:", error);
  }

  // Fallback to original posts if Gemini fails
  return posts;
};

export const generateCustomFeed = async (
  keywords: string[],
  contentTypes: string[],
  hashtags: string[],
  requiresMedia = false,
  mediaType?: "images" | "videos" | "any",
  limit = 30,
  originalDescription?: string,
) => {
  const allPosts: any[] = [];
  const targetPosts = Math.max(20, limit); // Ensure we get at least 20 quality posts
  const maxPages = 50; // Maximum pages to search before giving up

  console.log(
    `🔍 Searching for ${targetPosts} quality posts (16 hours to 3 days old)...`,
  );

  // Helper function to search with exponential hopping and backward time search
  const searchWithPagination = async (query: string, searchType: string) => {
    let cursor: string | undefined;
    let pageCount = 0;
    let foundPosts: any[] = [];
    let imagePosts: any[] = [];
    let pageHops = [5, 10, 20, 40, 80]; // Exponential hopping sequence
    let currentHopIndex = 0;

    // Phase 1: Exponential hopping to find posts quickly
    console.log(
      `  🔍 EXPONENTIAL HOPPING: Starting exponential hop search for "${query}" (target pages: ${pageHops.join(', ')})`,
    );
    let foundPostsOnPage = false;
    while (
      currentHopIndex < pageHops.length &&
      foundPosts.length < targetPosts / keywords.length &&
      !foundPostsOnPage
    ) {
      const targetPage = pageHops[currentHopIndex];
      console.log(
        `  ⏩ HOPPING: Jumping to page ${targetPage} for "${query}" (hop ${currentHopIndex + 1}/${pageHops.length})`,
      );

      // Skip pages we've already processed
      while (pageCount < targetPage - 1 && cursor) {
        try {
          const result = await searchPosts(query, 100, cursor); // Max batch size for efficiency
          cursor = result.cursor;
          pageCount++;

          if (!cursor) break;

          // Minimal delay for skipping
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.warn(
            `Failed to skip to page ${targetPage} for "${query}":`,
            error,
          );
          break;
        }
      }

      // Process the target page
      if (cursor || pageCount === 0) {
        try {
          const result = await searchPosts(query, 100, cursor); // Max batch size for efficiency
          const posts = result.posts;
          cursor = result.cursor;
          pageCount++;

          if (posts.length === 0) break;

          // Apply age filter first
          const ageFilteredPosts = filterPostsByAge(posts);

          // Separate image posts from regular posts
          const postsWithImages = ageFilteredPosts.filter(
            (post) => post.embed?.images?.length > 0 || post.embed?.video,
          );
          const postsWithoutImages = ageFilteredPosts.filter(
            (post) => !(post.embed?.images?.length > 0 || post.embed?.video),
          );

          // Add to appropriate collections
          imagePosts.push(
            ...postsWithImages.map((post) => ({
              ...post,
              searchTerm: query,
              searchType,
            })),
          );

          foundPosts.push(
            ...ageFilteredPosts.map((post) => ({
              ...post,
              searchTerm: query,
              searchType,
            })),
          );

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 300));

          console.log(
            `  📄 HOP: ${query} page ${pageCount} (hop ${targetPage}): ${ageFilteredPosts.length}/${posts.length} posts in age range, ${postsWithImages.length} with images`,
          );

          // If we found any posts in age range, switch to sequential search
          if (ageFilteredPosts.length > 0) {
            console.log(
              `  🎯 HOP SUCCESS: Found ${ageFilteredPosts.length} posts on page ${pageCount}, ending exponential hopping and switching to sequential search`,
            );
            foundPostsOnPage = true;
            break;
          } else {
            console.log(
              `  ❌ HOP: No posts found on page ${pageCount}, continuing to next hop...`,
            );
          }
        } catch (error) {
          console.warn(
            `Failed to search page ${pageCount} for "${query}":`,
            error,
          );
          break;
        }
      }

      currentHopIndex++;
    }

    if (!foundPostsOnPage && currentHopIndex >= pageHops.length) {
      console.log(
        `  ❌ EXPONENTIAL HOPPING COMPLETE: No posts found in any hop pages for "${query}", skipping forward/backward search`,
      );
    }

    // Phase 1.5: Sequential forward search from where we found posts
    if (foundPostsOnPage && foundPosts.length < targetPosts / keywords.length) {
      console.log(
        `  ➡️ FORWARD SEARCH: Starting sequential forward search for "${query}" from page ${pageCount + 1} (currently have ${foundPosts.length} posts, need ${Math.ceil(targetPosts / keywords.length)})`,
      );

      let sequentialPages = 0;
      const maxSequentialPages = 15; // Search next 15 pages sequentially

      while (
        cursor &&
        sequentialPages < maxSequentialPages &&
        foundPosts.length < targetPosts / keywords.length
      ) {
        try {
          const result = await searchPosts(query, 100, cursor);
          const posts = result.posts;
          cursor = result.cursor;
          pageCount++;
          sequentialPages++;

          if (posts.length === 0) break;

          // Apply age filter first
          const ageFilteredPosts = filterPostsByAge(posts);

          // Add to collection with search context
          foundPosts.push(
            ...ageFilteredPosts.map((post) => ({
              ...post,
              searchTerm: query,
              searchType,
            })),
          );

          // Track image posts for potential backward search
          const postsWithImages = ageFilteredPosts.filter(
            (post) => post.embed?.images?.length > 0 || post.embed?.video,
          );
          imagePosts.push(
            ...postsWithImages.map((post) => ({
              ...post,
              searchTerm: query,
              searchType,
            })),
          );

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 300));

          console.log(
            `  📄 FORWARD: ${query} sequential page ${pageCount} (${sequentialPages}/${maxSequentialPages}): ${ageFilteredPosts.length}/${posts.length} posts in age range, total found: ${foundPosts.length}`,
          );

          // If we're not finding much, reduce the sequential search
          if (ageFilteredPosts.length === 0 && sequentialPages >= 5) {
            console.log(
              `  ⚠️ FORWARD: No posts found in last page, stopping sequential search early (${sequentialPages}/${maxSequentialPages} pages searched)`,
            );
            break;
          }
        } catch (error) {
          console.warn(
            `Failed to search sequential page ${pageCount} for "${query}":`,
            error,
          );
          break;
        }
      }

      console.log(
        `  ✅ FORWARD SEARCH COMPLETE: ${sequentialPages} pages searched sequentially, ${foundPosts.length} total posts found from "${query}"`,
      );
    }

    // Phase 2: If we found images, go backwards in time until pool quota is reached
    if (
      imagePosts.length > 0 &&
      foundPosts.length < targetPosts / keywords.length
    ) {
      console.log(
        `  ⏪ BACKWARD SEARCH: Starting backward time search for "${query}" to fill pool quota (found ${imagePosts.length} image posts, have ${foundPosts.length}/${Math.ceil(targetPosts / keywords.length)} posts)`,
      );

      // Continue searching backwards from current position
      let backwardPages = 0;
      const maxBackwardPages = 20;

      while (
        cursor &&
        backwardPages < maxBackwardPages &&
        foundPosts.length < targetPosts / keywords.length
      ) {
        try {
          const result = await searchPosts(query, 100, cursor); // Max batch size for efficiency
          const posts = result.posts;
          cursor = result.cursor;
          pageCount++;
          backwardPages++;

          if (posts.length === 0) break;

          // Apply age filter first
          const ageFilteredPosts = filterPostsByAge(posts);

          // Add to collection with search context
          foundPosts.push(
            ...ageFilteredPosts.map((post) => ({
              ...post,
              searchTerm: query,
              searchType,
            })),
          );

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 300));

          console.log(
            `  📄 BACKWARD: ${query} backward page ${backwardPages} (${backwardPages}/${maxBackwardPages}): ${ageFilteredPosts.length}/${posts.length} posts in age range, total found: ${foundPosts.length}`,
          );
        } catch (error) {
          console.warn(
            `Failed to search backward page ${backwardPages} for "${query}":`,
            error,
          );
          break;
        }
      }
      
      console.log(
        `  ✅ BACKWARD SEARCH COMPLETE: ${backwardPages} backward pages searched for "${query}"`,
      );
    } else if (imagePosts.length === 0) {
      console.log(
        `  ⏭️ SKIPPING BACKWARD SEARCH: No image posts found for "${query}" to trigger backward search`,
      );
    } else {
      console.log(
        `  ⏭️ SKIPPING BACKWARD SEARCH: Already have enough posts (${foundPosts.length}/${Math.ceil(targetPosts / keywords.length)}) for "${query}"`,
      );
    }

    console.log(
      `  ✅ ${query}: Found ${foundPosts.length} posts (${imagePosts.length} with images) after ${pageCount} pages total`,
    );
    return foundPosts;
  };

  // Search by keywords with prioritization - first keyword is most important
  console.log(
    `🎯 Prioritizing first keyword: "${keywords[0]}" as primary search`,
  );

  // Search first keyword extensively
  if (keywords.length > 0) {
    const primaryKeywordPosts = await searchWithPagination(
      keywords[0],
      "primary_keyword",
    );
    allPosts.push(...primaryKeywordPosts);

    console.log(
      `📊 Primary keyword "${keywords[0]}" found ${primaryKeywordPosts.length} posts`,
    );
  }

  // Only search additional keywords if we don't have enough posts from the first one
  if (allPosts.length < targetPosts && keywords.length > 1) {
    console.log(
      `🔄 Primary keyword insufficient (${allPosts.length}/${targetPosts}), searching fallback keywords`,
    );

    for (const keyword of keywords.slice(1, 6)) {
      const keywordPosts = await searchWithPagination(
        keyword,
        "fallback_keyword",
      );
      allPosts.push(...keywordPosts);

      console.log(
        `📊 Fallback keyword "${keyword}" found ${keywordPosts.length} posts (total: ${allPosts.length})`,
      );

      // Early exit if we have enough posts
      if (allPosts.length >= targetPosts * 2) {
        console.log(
          `✅ Reached target posts quota (${allPosts.length}/${targetPosts * 2}), stopping keyword search`,
        );
        break;
      }
    }
  } else if (allPosts.length >= targetPosts) {
    console.log(
      `✅ Primary keyword provided sufficient posts (${allPosts.length}/${targetPosts}), skipping fallback keywords`,
    );
  }

  // Search by hashtags with prioritization - only if we still need more posts
  if (allPosts.length < targetPosts * 2 && hashtags.length > 0) {
    console.log(
      `🏷️  Searching hashtags to supplement posts (current: ${allPosts.length}/${targetPosts * 2})`,
    );

    // Search first hashtag extensively
    const primaryHashtagPosts = await searchWithPagination(
      `#${hashtags[0]}`,
      "primary_hashtag",
    );
    allPosts.push(...primaryHashtagPosts);

    console.log(
      `📊 Primary hashtag "#${hashtags[0]}" found ${primaryHashtagPosts.length} posts`,
    );

    // Search additional hashtags if still needed
    if (allPosts.length < targetPosts * 2 && hashtags.length > 1) {
      console.log(
        `🔄 Primary hashtag insufficient, searching fallback hashtags`,
      );

      for (const hashtag of hashtags.slice(1, 4)) {
        const hashtagPosts = await searchWithPagination(
          `#${hashtag}`,
          "fallback_hashtag",
        );
        allPosts.push(...hashtagPosts);

        console.log(
          `📊 Fallback hashtag "#${hashtag}" found ${hashtagPosts.length} posts (total: ${allPosts.length})`,
        );

        // Early exit if we have enough posts
        if (allPosts.length >= targetPosts * 2) {
          console.log(
            `✅ Reached target posts quota with hashtags (${allPosts.length}/${targetPosts * 2})`,
          );
          break;
        }
      }
    }
  } else if (allPosts.length >= targetPosts * 2) {
    console.log(
      `✅ Skipping hashtag search - already have sufficient posts (${allPosts.length}/${targetPosts * 2})`,
    );
  }

  // Early exit if we couldn't find enough posts
  if (allPosts.length < 10) {
    console.log(
      `⚠️ Only found ${allPosts.length} posts in age range. Consider adjusting search terms.`,
    );
  }

  // Remove duplicates
  const uniquePosts = allPosts.filter(
    (post, index, array) =>
      array.findIndex((p) => p.uri === post.uri) === index,
  );

  console.log(
    `📊 Found ${uniquePosts.length} unique posts in age range (16h-3d old)`,
  );

  // Apply quality filtering
  const qualityPosts = filterQualityPosts(
    uniquePosts,
    requiresMedia,
    mediaType,
  );

  console.log(`🔍 ${qualityPosts.length} posts passed quality filters`);

  // Enrich high-engagement posts with author follower data
  const enrichedPosts = await enrichPostsWithAuthorData(qualityPosts);

  // Apply Gemini relevance filtering if we have too many posts and a description
  let relevantPosts = enrichedPosts;
  if (originalDescription && enrichedPosts.length > 20) {
    relevantPosts = await filterPostsWithGemini(
      enrichedPosts,
      originalDescription,
      keywords,
    );
  }

  // Enhanced scoring with engagement-based prioritization
  const scoredPosts = relevantPosts.map((post) => {
    const replyCount = post.replyCount || 0;
    const likeCount = post.likeCount || 0;
    const repostCount = post.repostCount || 0;
    const followersCount = post.author?.followersCount || 0;

    // Base engagement score
    let engagementScore = likeCount + replyCount * 2 + repostCount * 1.5;

    // High-quality post bonus with follower count when available
    let qualityBonus = 0;
    if (replyCount >= 3 && likeCount >= 5) {
      qualityBonus = 50; // High engagement boost

      // Additional boost for established authors (when follower data available)
      if (followersCount >= 100) {
        qualityBonus += 25; // Established author bonus
      } else if (followersCount >= 10) {
        qualityBonus += 10; // Decent following bonus
      }

      console.log(
        `High-quality post found: ${likeCount} likes, ${replyCount} replies, ${followersCount} followers`,
      );
    } else if (replyCount >= 2 && likeCount >= 3) {
      qualityBonus = 20; // Medium engagement boost
      if (followersCount >= 50) {
        qualityBonus += 10; // Author boost for medium engagement
      }
    } else if (likeCount >= 2) {
      qualityBonus = 5; // Minimal engagement boost
    }

    return {
      ...post,
      engagementScore,
      qualityBonus,
      totalScore: engagementScore + qualityBonus,
    };
  });

  scoredPosts.sort((a, b) => {
    // Recency scoring - favor posts 1-10 days old (sweet spot for verified engagement)
    const now = new Date().getTime();
    const aAge = now - new Date(a.indexedAt).getTime();
    const bAge = now - new Date(b.indexedAt).getTime();

    // Convert to days
    const aAgeDays = aAge / (1000 * 60 * 60 * 24);
    const bAgeDays = bAge / (1000 * 60 * 60 * 24);

    // Recency score curve: peaks around 1-10 days
    const getRecencyScore = (ageDays: number) => {
      if (ageDays < 1) return 5; // Very new posts get low score (unverified)
      if (ageDays <= 3) return 15; // 1-3 days: good score
      if (ageDays <= 7) return 20; // 3-7 days: peak score
      if (ageDays <= 14) return 15; // 7-14 days: still good
      if (ageDays <= 30) return 8; // 2-4 weeks: declining
      return 2; // Older than a month: very low
    };

    const aRecencyScore = getRecencyScore(aAgeDays);
    const bRecencyScore = getRecencyScore(bAgeDays);

    // Final score: engagement + quality bonus + recency
    const aFinalScore = a.totalScore + aRecencyScore;
    const bFinalScore = b.totalScore + bRecencyScore;

    return bFinalScore - aFinalScore;
  });

  const result = scoredPosts.slice(0, limit);
  console.log(
    `Generated ${result.length} posts from ${allPosts.length} total search results`,
  );
  return result;
};

interface NetworkCache {
  followingList: { users: string[]; timestamp: number } | null;
  networkGraph: Map<string, { weight: number; via: string; timestamp: number }>;
  userFollowers: Map<string, { followers: string[]; timestamp: number }>;
  userProfiles: Map<string, { handle: string; displayName: string }>;
}

const cache: NetworkCache = {
  followingList: null,
  networkGraph: new Map(),
  userFollowers: new Map(),
  userProfiles: new Map(),
};

// Persistent cache using localStorage
const PERSISTENT_CACHE_KEY = "bluesky_network_cache";

interface PersistentCache {
  followingList: { users: string[]; timestamp: number } | null;
  networkGraph: Array<
    [string, { weight: number; via: string; timestamp: number }]
  >;
  userFollowers: Array<[string, { followers: string[]; timestamp: number }]>;
  userProfiles: Array<[string, { handle: string; displayName: string }]>;
}

const savePersistentCache = (userDid: string) => {
  try {
    const persistentData: PersistentCache = {
      followingList: cache.followingList,
      networkGraph: Array.from(cache.networkGraph.entries()),
      userFollowers: Array.from(cache.userFollowers.entries()),
      userProfiles: Array.from(cache.userProfiles.entries()),
    };

    localStorage.setItem(
      `${PERSISTENT_CACHE_KEY}_${userDid}`,
      JSON.stringify(persistentData),
    );
    console.log("💾 Saved cache to localStorage");
  } catch (error) {
    console.warn("Failed to save cache to localStorage:", error);
  }
};

const loadPersistentCache = (userDid: string) => {
  try {
    const stored = localStorage.getItem(`${PERSISTENT_CACHE_KEY}_${userDid}`);
    if (!stored) return;

    const persistentData: PersistentCache = JSON.parse(stored);

    // Restore in-memory cache from localStorage
    cache.followingList = persistentData.followingList;
    cache.networkGraph = new Map(persistentData.networkGraph);
    cache.userFollowers = new Map(persistentData.userFollowers);
    cache.userProfiles = new Map(persistentData.userProfiles || []);

    console.log("📥 Loaded cache from localStorage");
    console.log("- Following list:", cache.followingList ? "cached" : "empty");
    console.log("- Network graph size:", cache.networkGraph.size);
    console.log("- User followers cache size:", cache.userFollowers.size);
    console.log("- User profiles cache size:", cache.userProfiles.size);
  } catch (error) {
    console.warn("Failed to load cache from localStorage:", error);
  }
};

const clearPersistentCache = (userDid: string) => {
  try {
    localStorage.removeItem(`${PERSISTENT_CACHE_KEY}_${userDid}`);

    // Clear in-memory cache too
    cache.followingList = null;
    cache.networkGraph.clear();
    cache.userFollowers.clear();
    cache.userProfiles.clear();

    // Clear network posts cache
    networkPostsCache = [];
    networkCacheTimestamp = 0;

    console.log("🗑️ Cleared all caches");
  } catch (error) {
    console.warn("Failed to clear cache:", error);
  }
};

// Debug: Expose cache to browser console for inspection
if (typeof window !== "undefined") {
  (window as any).blueskyCache = cache;
  (window as any).inspectCache = () => {
    console.log("=== BLUESKY CACHE INSPECTION ===");
    console.log("Following List:", cache.followingList);
    console.log("Network Graph Size:", cache.networkGraph.size);
    console.log("User Followers Cache Size:", cache.userFollowers.size);
    console.log("Network Graph:", Array.from(cache.networkGraph.entries()));
    console.log("User Followers:", Array.from(cache.userFollowers.entries()));
  };
  (window as any).clearCache = () => {
    if (agent.session) {
      clearPersistentCache(agent.session.did);
    }
  };
  (window as any).getCacheStats = () => {
    const now = Date.now();
    console.log("=== CACHE STATISTICS ===");
    console.log(
      "Following List:",
      cache.followingList
        ? `${cache.followingList.users.length} users (${Math.round((now - cache.followingList.timestamp) / (1000 * 60))} min old)`
        : "Not cached",
    );
    console.log("Network Graph:", `${cache.networkGraph.size} connections`);
    console.log("User Followers:", `${cache.userFollowers.size} users cached`);
    console.log(
      "Network Posts:",
      networkPostsCache.length
        ? `${networkPostsCache.length} posts (${Math.round((now - networkCacheTimestamp) / (1000 * 60))} min old)`
        : "Not cached",
    );

    // Show localStorage usage
    try {
      const stored = localStorage.getItem(
        `${PERSISTENT_CACHE_KEY}_${agent.session?.did}`,
      );
      console.log(
        "LocalStorage Size:",
        stored ? `${(stored.length / 1024).toFixed(1)} KB` : "No data",
      );
    } catch (e) {
      console.log("LocalStorage Size: Unknown");
    }
  };
}

const NETWORK_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours
const FOLLOWERS_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours
const MAX_NETWORK_SIZE = 1000;

export const getFollowersOfFollowers = async (limit = 100) => {
  if (!agent.session) throw new Error("Not authenticated");

  const userId = agent.session.did;
  const now = Date.now();

  // Load persistent cache on first call
  if (cache.networkGraph.size === 0 && cache.followingList === null) {
    loadPersistentCache(userId);
  }

  // Check cache for network graph
  const cachedNetwork = cache.networkGraph;
  const hasFreshNetworkCache = Array.from(cachedNetwork.values()).some(
    (entry) => now - entry.timestamp < NETWORK_CACHE_TTL,
  );

  if (hasFreshNetworkCache && cachedNetwork.size > 0) {
    return Array.from(cachedNetwork.entries())
      .filter(([_, data]) => now - data.timestamp < NETWORK_CACHE_TTL)
      .sort((a, b) => b[1].weight - a[1].weight)
      .slice(0, limit)
      .map(([userId, data]) => ({
        userId,
        weight: data.weight,
        via: data.via,
      }));
  }

  // Get user's following list (with caching)
  let followingList: string[] = [];

  if (
    cache.followingList &&
    now - cache.followingList.timestamp < FOLLOWERS_CACHE_TTL
  ) {
    followingList = cache.followingList.users;
  } else {
    let cursor: string | undefined;

    try {
      do {
        const response = await agent.app.bsky.graph.getFollows({
          actor: userId,
          limit: 100,
          cursor,
        });

        followingList.push(
          ...response.data.follows.map((follow) => follow.did),
        );
        
        // Store user profiles in cache for later use
        response.data.follows.forEach((follow) => {
          cache.userProfiles.set(follow.did, {
            handle: follow.handle,
            displayName: follow.displayName || follow.handle,
          });
        });
        cursor = response.data.cursor;

        // Prevent infinite loops and rate limiting
        if (followingList.length > 500) break;
      } while (cursor);

      cache.followingList = { users: followingList, timestamp: now };

      // Save to persistent storage
      savePersistentCache(userId);
    } catch (error) {
      console.error("Error fetching following list:", error);
      throw error;
    }
  }

  // Build followers-of-followers network
  const networkGraph = new Map<
    string,
    { weight: number; via: string; timestamp: number }
  >();
  const processedUsers = new Set<string>();

  // Helper function to get cached followers for a user
  const getCachedFollowers = async (userDid: string): Promise<string[]> => {
    const cached = cache.userFollowers.get(userDid);
    if (cached && now - cached.timestamp < FOLLOWERS_CACHE_TTL) {
      return cached.followers;
    }

    try {
      const response = await agent.app.bsky.graph.getFollowers({
        actor: userDid,
        limit: 100,
      });

      const followers = response.data.followers.map((f) => f.did);
      cache.userFollowers.set(userDid, { followers, timestamp: now });

      // Save to persistent storage (throttled to avoid too many saves)
      if (Math.random() < 0.1) {
        // Save only 10% of the time to avoid spam
        savePersistentCache(userDid);
      }

      return followers;
    } catch (error) {
      console.warn(`Failed to fetch followers for ${userDid}:`, error);
      return [];
    }
  };

  // Process in batches to avoid rate limiting
  const batchSize = 3; // Reduced batch size for better rate limiting
  for (let i = 0; i < Math.min(followingList.length, 30); i += batchSize) {
    // Reduced from 50 to 30
    const batch = followingList.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (followedUserId) => {
        if (processedUsers.has(followedUserId)) return;
        processedUsers.add(followedUserId);

        const followers = await getCachedFollowers(followedUserId);

        followers.forEach((followerDid) => {
          // Skip if user already follows this person
          if (followingList.includes(followerDid)) return;
          // Skip self
          if (followerDid === userId) return;

          const existing = networkGraph.get(followerDid);
          const weight = existing ? existing.weight + 1 : 1;
          
          // Get display name from cached profile
          const profile = cache.userProfiles.get(followedUserId);
          const viaName = profile?.displayName || profile?.handle || followedUserId;

          networkGraph.set(followerDid, {
            weight,
            via: viaName,
            timestamp: now,
          });
        });
      }),
    );

    // Add delay between batches to avoid rate limiting
    if (i + batchSize < followingList.length) {
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Increased delay
    }
  }

  // Store in cache
  cache.networkGraph = networkGraph;

  // Save to persistent storage
  savePersistentCache(userId);

  // Return top candidates
  return Array.from(networkGraph.entries())
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, Math.min(limit, MAX_NETWORK_SIZE))
    .map(([userId, data]) => ({ userId, weight: data.weight, via: data.via }));
};

// Force refresh cache - clears everything and rebuilds from API
export const refreshNetworkCache = async () => {
  if (!agent.session) throw new Error("Not authenticated");

  const userId = agent.session.did;

  console.log("🔄 Force refreshing network cache...");

  // Clear all caches
  clearPersistentCache(userId);

  // Force rebuild by calling getFollowersOfFollowersFeed with forceRefresh
  await getFollowersOfFollowersFeed(undefined, 10, true);

  console.log("✅ Network cache refreshed!");
};

// Post cache for network feed pagination
let networkPostsCache: any[] = [];
let networkCacheTimestamp = 0;
const NETWORK_POSTS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export const getFollowersOfFollowersFeed = async (
  cursor?: string,
  limit = 10,
  forceRefresh = false,
) => {
  if (!agent.session) throw new Error("Not authenticated");

  try {
    const now = Date.now();

    // Check if we need to rebuild the posts cache
    const needsRebuild =
      forceRefresh || // Explicit refresh requested
      networkPostsCache.length === 0 || // No cache
      now - networkCacheTimestamp > NETWORK_POSTS_CACHE_TTL; // Cache expired

    console.log(
      `📊 Cache check: forceRefresh=${forceRefresh}, cacheSize=${networkPostsCache.length}, cursor=${cursor}`,
    );

    if (needsRebuild) {
      const reason = forceRefresh
        ? "force refresh"
        : networkPostsCache.length === 0
          ? "no cache"
          : "cache expired";
      console.log(`🔄 Building network posts cache (${reason})...`);

      // Get followers-of-followers network (this should use cache)
      const network = await getFollowersOfFollowers(50);

      if (network.length === 0) {
        return {
          feed: [],
          cursor: undefined,
        };
      }

      // Get posts from network users (only when rebuilding cache)
      const networkUserIds = network.slice(0, 20).map((n) => n.userId); // Use more users for variety
      const posts: any[] = [];

      // Get current user's following list to ensure separation
      const followingList = cache.followingList ? cache.followingList.users : [];
      console.log(`🔍 FEED SEPARATION: Fetching network posts from ${networkUserIds.length} users, excluding ${followingList.length} followed users`);

      // Fetch posts from network users sequentially
      for (let i = 0; i < networkUserIds.length && posts.length < 50; i++) {
        // Get more posts for pagination
        const userId = networkUserIds[i];

        // CRITICAL: Double-check this user is NOT in our following list
        if (followingList.includes(userId)) {
          console.log(`⚠️ FEED SEPARATION: Skipping ${userId} - found in following list (should not happen)`);
          continue;
        }

        try {
          const response = await agent.app.bsky.feed.getAuthorFeed({
            actor: userId,
            limit: 3,
            filter: "posts_no_replies",
          });

          // Add relationship context to posts
          const userNetwork = network.find((n) => n.userId === userId);
          const postsWithContext = response.data.feed.map((post) => ({
            ...post,
            networkContext: {
              via: userNetwork?.via,
              weight: userNetwork?.weight,
            },
          }));

          posts.push(...postsWithContext);
          console.log(`✅ NETWORK FEED: Added ${response.data.feed.length} posts from ${userId} (via network, not followed)`);

          // Small delay between requests
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (error) {
          console.warn(`Failed to fetch posts for ${userId}:`, error);
        }
      }

      // Remove duplicates and cache
      networkPostsCache = posts.filter(
        (post, index, array) =>
          array.findIndex((p) => p.post.uri === post.post.uri) === index,
      );
      networkCacheTimestamp = now;

      console.log(`✅ NETWORK FEED: Cached ${networkPostsCache.length} unique posts from followers-of-followers (excluded ${followingList.length} followed users)`);
    }

    // Pagination using cached posts
    let startIndex = 0;
    if (cursor && cursor.startsWith("network_")) {
      startIndex = parseInt(cursor.split("_")[1]) || 0;
    }

    // Return paginated posts from cache
    const paginatedPosts = networkPostsCache.slice(
      startIndex,
      startIndex + limit,
    );
    const hasMore = startIndex + limit < networkPostsCache.length;

    console.log(
      `📄 Returning posts ${startIndex + 1}-${startIndex + paginatedPosts.length} of ${networkPostsCache.length} cached`,
    );

    return {
      feed: paginatedPosts,
      cursor: hasMore ? `network_${startIndex + limit}` : undefined,
    };
  } catch (error) {
    console.error("Error fetching followers-of-followers feed:", error);
    throw error;
  }
};

export const getUserProfile = async (actor: string) => {
  try {
    const response = await agent.app.bsky.actor.getProfile({
      actor,
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    throw error;
  }
};

export const followUser = async (did: string) => {
  try {
    await agent.app.bsky.graph.follow.create(
      { repo: agent.session!.did },
      {
        subject: did,
        createdAt: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error("Error following user:", error);
    throw error;
  }
};

export const unfollowUser = async (did: string) => {
  try {
    // Get the user's profile to find the follow record
    const profile = await agent.app.bsky.actor.getProfile({ actor: did });
    
    if (profile.data.viewer?.following) {
      await agent.app.bsky.graph.follow.delete({
        repo: agent.session!.did,
        rkey: profile.data.viewer.following.split("/").pop()!,
      });
    }
  } catch (error) {
    console.error("Error unfollowing user:", error);
    throw error;
  }
};
