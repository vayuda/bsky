import React, { useState, useEffect } from 'react';
import { feedFactory, CustomFeed, FEED_TEMPLATES } from '../services/feedFactory';
import { PostCarousel } from './PostCarousel';
import { useCarouselFeed } from '../hooks/useCarouselFeed';
import { BskyAgent } from '@atproto/api';

interface FeedFactoryProps {
  agent: BskyAgent | null;
}

const FeedFactory: React.FC<FeedFactoryProps> = ({ agent }) => {
  const [description, setDescription] = useState('');
  const [feedName, setFeedName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeFeedId, setActiveFeedId] = useState<string | null>(null);
  const [savedFeeds, setSavedFeeds] = useState<CustomFeed[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Use carousel hook for custom feeds
  const {
    posts,
    currentPostIndex,
    isLoading: isLoadingFeed,
    sessionStats,
    nextPost,
    prevPost,
    loadNextBatch,
    refresh,
    isAtSessionSummary,
    isNetworkExhausted,
  } = useCarouselFeed({
    agent,
    feedType: activeFeedId ? 'custom' : 'following',
    customFeedId: activeFeedId || undefined,
  });

  useEffect(() => {
    // Load saved feeds on component mount
    feedFactory.loadFromStorage();
    setSavedFeeds(feedFactory.getAllFeeds());
  }, []);

  const handleGenerateFeed = async () => {
    if (!description.trim()) {
      setError('Please enter a description');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const feed = await feedFactory.createFeedFromDescription(description, feedName || undefined);
      setActiveFeedId(feed.id);
      setSavedFeeds(feedFactory.getAllFeeds());
      feedFactory.saveToStorage();
      setDescription('');
      setFeedName('');
    } catch (error) {
      setError('Failed to generate feed. Please try again.');
      console.error('Feed generation error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseTemplate = (templateId: string) => {
    const template = FEED_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setDescription(template.examples[0]);
      setFeedName(template.name);
    }
  };

  const handleLoadSavedFeed = (feed: CustomFeed) => {
    setActiveFeedId(feed.id);
  };

  const handleDeleteFeed = (feedId: string) => {
    feedFactory.deleteFeed(feedId);
    setSavedFeeds(feedFactory.getAllFeeds());
    feedFactory.saveToStorage();
    
    if (activeFeedId === feedId) {
      setActiveFeedId(null);
    }
  };

  const handleRefreshFeed = async () => {
    if (activeFeedId) {
      try {
        await feedFactory.refreshFeed(activeFeedId);
        setSavedFeeds(feedFactory.getAllFeeds());
        feedFactory.saveToStorage();
        await refresh(); // Refresh the carousel
      } catch (error) {
        setError('Failed to refresh feed');
      }
    }
  };

  const currentFeed = activeFeedId ? feedFactory.getFeed(activeFeedId) : null;

  return (
    <div className="flex h-full">
      {/* Main Feed Area (Left) */}
      <div className="flex-1 min-w-0">
        {activeFeedId && currentFeed ? (
          <div className="h-full">
            {/* Feed Header */}
            <div className="sticky top-0 bg-beige/80 backdrop-blur-md border-b border-mocha/30 z-10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-red font-serif">{currentFeed.name}</h2>
                  <p className="text-sm text-dark">
                    {currentFeed.posts.length} posts • Updated {currentFeed.lastUpdated.toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleRefreshFeed}
                    className="text-red hover:text-coffee text-sm px-3 py-1 rounded-md hover:bg-beige"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={() => setActiveFeedId(null)}
                    className="text-coffee hover:text-dark p-1"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Search Parameters Display */}
              <div className="mt-2 p-2 bg-milk rounded-md text-xs">
                <div className="text-dark">
                  <span className="font-medium">Keywords:</span> {currentFeed.searchParams.keywords.join(', ')}
                </div>
                {currentFeed.searchParams.hashtags.length > 0 && (
                  <div className="text-dark">
                    <span className="font-medium">Hashtags:</span> #{currentFeed.searchParams.hashtags.join(', #')}
                  </div>
                )}
                {currentFeed.searchParams.requiresMedia && (
                  <div className="text-red">
                    <span className="font-medium">Media Required:</span> {currentFeed.searchParams.mediaType || 'any'}
                  </div>
                )}
              </div>
            </div>

            {/* PostCarousel */}
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
              feedType="custom"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8">
              <div className="text-6xl mb-4">🏭</div>
              <h2 className="text-2xl font-bold text-red font-serif mb-2">Feed Factory</h2>
              <p className="text-dark mb-4">
                Create custom feeds using AI-powered search
              </p>
              <p className="text-sm text-coffee">
                Use the controls on the right to generate your first custom feed
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Controls Sidebar (Right) */}
      <div className="w-80 border-l border-mocha/30 bg-beige p-4 space-y-6 overflow-y-auto">
        {/* Feed Generation */}
        <div className="bg-milk rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-semibold text-red font-serif mb-4">Create Feed</h3>
          
          <div className="space-y-3">
            <div>
              <label htmlFor="feedName" className="block text-sm font-medium text-dark mb-1">
                Feed Name (optional)
              </label>
              <input
                id="feedName"
                type="text"
                value={feedName}
                onChange={(e) => setFeedName(e.target.value)}
                placeholder="My Custom Feed"
                className="w-full p-2 text-sm border border-mocha/30 rounded-md focus:ring-1 focus:ring-red focus:border-transparent bg-milk text-dark"
              />
            </div>
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-dark mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., cat pictures, latest tech news, digital art..."
                rows={3}
                className="w-full p-2 text-sm border border-mocha/30 rounded-md focus:ring-1 focus:ring-red focus:border-transparent resize-none bg-milk text-dark"
              />
            </div>

            <button
              onClick={handleGenerateFeed}
              disabled={isGenerating || !description.trim()}
              className="w-full bg-coffee text-beige px-4 py-2 rounded-md hover:bg-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-beige border-t-transparent"></div>
                  <span>Generating...</span>
                </>
              ) : (
                <span>Generate Feed</span>
              )}
            </button>

            {error && (
              <div className="text-red text-xs bg-red/10 p-2 rounded-md">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Templates */}
        <div className="bg-milk rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-semibold text-red font-serif mb-3">Quick Templates</h3>
          <div className="space-y-2">
            {FEED_TEMPLATES.map((template) => (
              <div
                key={template.id}
                onClick={() => handleUseTemplate(template.id)}
                className="p-3 border border-mocha/30 rounded-md hover:border-red hover:bg-beige cursor-pointer transition-colors"
              >
                <h4 className="text-sm font-medium text-dark">{template.name}</h4>
                <p className="text-xs text-coffee mt-1">{template.description}</p>
                <p className="text-xs text-coffee mt-1">
                  "{template.examples[0]}"
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Saved Feeds */}
        {savedFeeds.length > 0 && (
          <div className="bg-milk rounded-lg shadow-sm p-4">
            <h3 className="text-lg font-semibold text-red font-serif mb-3">Saved Feeds</h3>
            <div className="space-y-2">
              {savedFeeds.map((feed) => (
                <div
                  key={feed.id}
                  className={`p-3 border rounded-md transition-colors ${
                    activeFeedId === feed.id
                      ? 'border-red bg-red/10'
                      : 'border-mocha/30 hover:bg-beige'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-dark truncate">{feed.name}</h4>
                      <p className="text-xs text-coffee truncate">{feed.description}</p>
                      <p className="text-xs text-coffee">
                        {feed.posts.length} posts
                      </p>
                    </div>
                    <div className="flex space-x-1 ml-2">
                      <button
                        onClick={() => handleLoadSavedFeed(feed)}
                        className="text-red hover:text-coffee text-xs px-2 py-1 rounded"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDeleteFeed(feed.id)}
                        className="text-red hover:text-dark text-xs px-2 py-1 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedFactory;