import React, { useState, useEffect } from "react";
import { ComposePost } from "./components/ComposePost";
import { PostCarousel } from "./components/PostCarousel";
import { Login } from "./components/Login";
import FeedFactory from "./components/FeedFactory";
import { loginToBluesky, refreshNetworkCache } from "./services/bluesky";
import { useCarouselFeed } from "./hooks/useCarouselFeed";
import { BskyAgent } from "@atproto/api";
import {
  RefreshCw,
  Home,
  TrendingUp,
  Search,
  PenTool,
} from "lucide-react";
import { Button } from "./components/ui/button";

// Feature flags
const ENABLE_SEARCH_FEED = true; // Set to true to enable Search feed feature

interface User {
  displayName: string;
  handle: string;
  avatar?: string;
}

function App() {
  const [agent, setAgent] = useState<BskyAgent | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeFeed, setActiveFeed] = useState<
    "following" | "discover" | "search" | "create"
  >("following");
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);
  const [searchState, setSearchState] = useState<{
    query: string;
    isActive: boolean;
    onRestart?: () => void;
  }>({ query: '', isActive: false });

  // Redirect away from disabled feeds
  useEffect(() => {
    console.log(`🚀 App: activeFeed changed to "${activeFeed}"`);
    if (!ENABLE_SEARCH_FEED && activeFeed === "search") {
      setActiveFeed("following");
    }
  }, [activeFeed]);

  const {
    posts,
    currentPostIndex,
    isLoading: isLoadingFeed,
    error: feedError,
    sessionStats,
    nextPost,
    prevPost,
    loadNextBatch,
    refresh,
    isAtSessionSummary,
    isNetworkExhausted,
  } = useCarouselFeed({
    agent: activeFeed === "search" ? null : agent, // Disable carousel hook for search
    feedType: activeFeed === "create" ? "following" : activeFeed === "search" ? "following" : activeFeed,
  });

  const handleLogin = async (identifier: string, password: string) => {
    setIsLoading(true);
    setLoginError(null);

    try {
      const loggedInAgent = await loginToBluesky(identifier, password);

      // Get user profile
      const profile = await loggedInAgent.getProfile({
        actor: loggedInAgent.session?.did || "",
      });

      setAgent(loggedInAgent);
      setUser({
        displayName: profile.data.displayName || profile.data.handle,
        handle: profile.data.handle,
        avatar: profile.data.avatar,
      });
    } catch (err: any) {
      console.error("Login failed:", err);
      setLoginError(
        err.message || "Login failed. Please check your credentials.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewPost = async (text: string) => {
    if (!agent) return;

    try {
      await agent.post({ text });
      // Refresh timeline to show the new post (only if on following feed)
      if (activeFeed === "following") {
        await refresh();
      }
    } catch (err) {
      console.error("Failed to create post:", err);
    }
  };

  const handleLogout = () => {
    setAgent(null);
    setUser(null);
    setLoginError(null);
  };

  const handleFeedChange = (
    newFeed: "following" | "discover" | "search" | "create",
  ) => {
    setActiveFeed(newFeed);
    // Reset search state when leaving search feed
    if (newFeed !== "search") {
      setSearchState({ query: '', isActive: false });
    }
  };

  const handleRefreshCache = async () => {
    if (!agent || isRefreshingCache) return;

    setIsRefreshingCache(true);
    try {
      await refreshNetworkCache();
      // Refresh the current feed to show new data
      await refresh();
    } catch (error) {
      console.error("Failed to refresh cache:", error);
    } finally {
      setIsRefreshingCache(false);
    }
  };

  // Show login page if not authenticated
  if (!agent || !user) {
    return (
      <Login onLogin={handleLogin} isLoading={isLoading} error={loginError} />
    );
  }

  return (
    <div className="min-h-screen bg-beige flex">
      {/* Left Sidebar */}
      <div className="w-64 border-r border-mocha/30 bg-milk">
        {/* Header */}
        <div className="sticky top-0 bg-milk/80 backdrop-blur-md border-b border-mocha/30 z-10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {user.avatar && (
                <img
                  src={user.avatar}
                  alt={user.displayName}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-dark truncate">
                  {user.displayName}
                </div>
                <div className="text-xs text-coffee truncate">
                  @{user.handle}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleLogout}
                className="text-sm text-coffee hover:text-dark"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Feed Navigation */}
        <div className="p-4 space-y-2">
          <button
            onClick={() => handleFeedChange("following")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeFeed === "following"
                ? "bg-red text-milk"
                : "text-dark hover:bg-beige hover:text-coffee"
            }`}
          >
            <Home className="h-5 w-5" />
            <span>Following</span>
          </button>
          <button
            onClick={() => handleFeedChange("discover")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeFeed === "discover"
                ? "bg-red text-milk"
                : "text-dark hover:bg-beige hover:text-coffee"
            }`}
          >
            <TrendingUp className="h-5 w-5" />
            <span>Network</span>
          </button>
          {ENABLE_SEARCH_FEED && (
            <button
              onClick={() => handleFeedChange("search")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeFeed === "search"
                  ? "bg-red text-milk"
                  : "text-dark hover:bg-beige hover:text-coffee"
              }`}
            >
              <Search className="h-5 w-5" />
              <span>Search</span>
            </button>
          )}
          <button
            onClick={() => handleFeedChange("create")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeFeed === "create"
                ? "bg-red text-milk"
                : "text-dark hover:bg-beige hover:text-coffee"
            }`}
          >
            <PenTool className="h-5 w-5" />
            <span>Create</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {/* Header */}
        <div className="sticky top-0 bg-beige/80 backdrop-blur-md border-b border-mocha/30 z-10">
          <div className="flex items-center justify-between p-4">
            <h1 className="text-xl font-bold text-red font-serif">
              {activeFeed === "following" && "Home"}
              {activeFeed === "discover" && "Network"}
              {activeFeed === "search" && ENABLE_SEARCH_FEED && (
                searchState.isActive ? (
                  <span className="text-base">Search: "{searchState.query}"</span>
                ) : (
                  "Search"
                )
              )}
              {activeFeed === "create" && "Create Post"}
            </h1>
            <div className="flex items-center space-x-4">
              {/* New Search button for active search */}
              {activeFeed === "search" && ENABLE_SEARCH_FEED && searchState.isActive && searchState.onRestart && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={searchState.onRestart}
                  className="text-sm"
                  title="Start a new search"
                >
                  New Search
                </Button>
              )}
              
              {activeFeed !== "create" && !(activeFeed === "search" && ENABLE_SEARCH_FEED) && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => refresh()}
                  disabled={isLoadingFeed}
                  className="h-8 w-8"
                  title="Refresh feed"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isLoadingFeed ? "animate-spin" : ""}`}
                  />
                </Button>
              )}

              {/* Cache refresh button - only show on discover feed */}
              {activeFeed === "discover" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshCache}
                  disabled={isRefreshingCache}
                  className="text-xs"
                  title="Rebuild network cache from scratch"
                >
                  {isRefreshingCache ? (
                    <>
                      <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin mr-1"></div>
                      Rebuilding...
                    </>
                  ) : (
                    <>🔄 Cache</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        {activeFeed === "create" ? (
          <div className="max-w-2xl mx-auto">
            <ComposePost currentUser={user} onPost={handleNewPost} />
          </div>
        ) : activeFeed === "search" && ENABLE_SEARCH_FEED ? (
          <div className="h-[calc(100vh-140px)]">
            <FeedFactory agent={agent} onSearchStateChange={setSearchState} />
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            {/* Loading State - show during any loading or when switching feeds */}
            {(isLoadingFeed || posts.length === 0) && !feedError && (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-2 border-red border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-dark">
                  {activeFeed === "following" && "Loading your timeline..."}
                  {activeFeed === "discover" && "Loading network feed..."}
                  {!["following", "discover"].includes(activeFeed) && "Loading..."}
                </p>
              </div>
            )}

            {/* Error State */}
            {feedError && (
              <div className="p-4 bg-red/10 border-b border-mocha/30">
                <p className="text-red text-center">{feedError}</p>
                <button
                  onClick={() => refresh()}
                  className="mt-2 w-full text-center text-red hover:text-coffee"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Post Carousel */}
            {posts.length > 0 && (
              <PostCarousel
                posts={posts}
                currentPostIndex={currentPostIndex}
                isAtSessionSummary={isAtSessionSummary}
                sessionStats={sessionStats}
                onNextPost={nextPost}
                onPrevPost={prevPost}
                onLoadNextBatch={loadNextBatch}
                isLoading={isLoadingFeed}
                isNetworkExhausted={isNetworkExhausted}
                feedType={activeFeed === "search" ? "custom" : activeFeed as "following" | "discover"}
              />
            )}

            {/* Empty State */}
            {!isLoadingFeed && posts.length === 0 && !feedError && (
              <div className="p-8 text-center">
                <p className="text-dark mb-4">
                  {activeFeed === "following"
                    ? "No posts to show. Follow some people to see their posts!"
                    : "No posts available in this feed right now."}
                </p>
                <Button variant="outline" onClick={() => refresh()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
