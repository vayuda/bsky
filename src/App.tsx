import React, { useState } from 'react';
import { ComposePost } from './components/ComposePost';
import { PostCarousel } from './components/PostCarousel';
import { Login } from './components/Login';
import FeedFactory from './components/FeedFactory';
import { loginToBluesky, refreshNetworkCache } from './services/bluesky';
import { useCarouselFeed } from './hooks/useCarouselFeed';
import { BskyAgent } from '@atproto/api';
import { RefreshCw, Home, TrendingUp, Users, Wand2 } from 'lucide-react';
import { Button } from './components/ui/button';

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
  const [activeFeed, setActiveFeed] = useState<'following' | 'discover' | 'popular' | 'factory'>('following');
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);

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
    agent,
    feedType: activeFeed === 'factory' ? 'following' : activeFeed,
  });

  const handleLogin = async (identifier: string, password: string) => {
    setIsLoading(true);
    setLoginError(null);

    try {
      const loggedInAgent = await loginToBluesky(identifier, password);

      // Get user profile
      const profile = await loggedInAgent.getProfile({ actor: loggedInAgent.session?.did || '' });

      setAgent(loggedInAgent);
      setUser({
        displayName: profile.data.displayName || profile.data.handle,
        handle: profile.data.handle,
        avatar: profile.data.avatar
      });

    } catch (err: any) {
      console.error('Login failed:', err);
      setLoginError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewPost = async (text: string) => {
    if (!agent) return;

    try {
      await agent.post({ text });
      // Refresh timeline to show the new post (only if on following feed)
      if (activeFeed === 'following') {
        await refresh();
      }
    } catch (err) {
      console.error('Failed to create post:', err);
    }
  };

  const handleLogout = () => {
    setAgent(null);
    setUser(null);
    setLoginError(null);
  };

  const handleFeedChange = (newFeed: 'following' | 'discover' | 'popular' | 'factory') => {
    setActiveFeed(newFeed);
  };

  const handleRefreshCache = async () => {
    if (!agent || isRefreshingCache) return;
    
    setIsRefreshingCache(true);
    try {
      await refreshNetworkCache();
      // Refresh the current feed to show new data
      await refresh();
    } catch (error) {
      console.error('Failed to refresh cache:', error);
    } finally {
      setIsRefreshingCache(false);
    }
  };

  // Show login page if not authenticated
  if (!agent || !user) {
    return <Login onLogin={handleLogin} isLoading={isLoading} error={loginError} />;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className={`${activeFeed === 'factory' ? 'w-full' : 'max-w-2xl mx-auto'} ${activeFeed === 'factory' ? '' : 'border-x border-gray-200'}`}>
        {/* Header */}
        <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-gray-200 z-10">
          <div className="flex items-center justify-between p-4">
            <h1 className="text-xl font-bold">
              {activeFeed === 'following' && 'Home'}
              {activeFeed === 'discover' && 'Network'}
              {activeFeed === 'popular' && 'Popular'}
              {activeFeed === 'factory' && 'Feed Factory'}
            </h1>
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refresh()}
                disabled={isLoadingFeed}
                className="h-8 w-8"
                title="Refresh feed"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingFeed ? 'animate-spin' : ''}`} />
              </Button>
              
              {/* Cache refresh button - only show on discover feed */}
              {activeFeed === 'discover' && (
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
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600">@{user.handle}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Logout
                </button>
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-white text-sm font-semibold">🦋</span>
              </div>
            </div>
          </div>

          {/* Feed Tabs */}
          <div className="flex border-t border-gray-200">
            <button
              onClick={() => handleFeedChange('following')}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors ${
                activeFeed === 'following'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Home className="h-4 w-4" />
              <span>Following</span>
            </button>
            <button
              onClick={() => handleFeedChange('discover')}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors ${
                activeFeed === 'discover'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              <span>Network</span>
            </button>
            <button
              onClick={() => handleFeedChange('popular')}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors ${
                activeFeed === 'popular'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Popular</span>
            </button>
            <button
              onClick={() => handleFeedChange('factory')}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors ${
                activeFeed === 'factory'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Wand2 className="h-4 w-4" />
              <span>Factory</span>
            </button>
          </div>
        </div>

        {/* Feed Factory */}
        {activeFeed === 'factory' ? (
          <div className="h-[calc(100vh-140px)]">
            <FeedFactory agent={agent} />
          </div>
        ) : (
          <>
            {/* Compose Post - Only show on Following feed */}
            {activeFeed === 'following' && (
              <ComposePost currentUser={user} onPost={handleNewPost} />
            )}

            {/* Initial Loading State */}
            {isLoadingFeed && posts.length === 0 && (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading your timeline...</p>
              </div>
            )}

            {/* Error State */}
            {feedError && (
              <div className="p-4 bg-red-50 border-b border-gray-200">
                <p className="text-red-600 text-center">{feedError}</p>
                <button
                  onClick={() => refresh()}
                  className="mt-2 w-full text-center text-blue-500 hover:text-blue-600"
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
                feedType={activeFeed as 'following' | 'discover' | 'popular'}
              />
            )}

            {/* Empty State */}
            {!isLoadingFeed && posts.length === 0 && !feedError && (
              <div className="p-8 text-center">
                <p className="text-gray-600 mb-4">
                  {activeFeed === 'following' 
                    ? "No posts to show. Follow some people to see their posts!" 
                    : "No posts available in this feed right now."}
                </p>
                <Button
                  variant="outline"
                  onClick={() => refresh()}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;