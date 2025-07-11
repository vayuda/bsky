import React, { useState } from 'react';
import { feedFactory } from '../services/feedFactory';
import { PostCarousel } from './PostCarousel';
import { useCarouselFeed } from '../hooks/useCarouselFeed';
import { BskyAgent } from '@atproto/api';

interface FeedFactoryProps {
  agent: BskyAgent | null;
  onSearchStateChange: (state: {
    query: string;
    isActive: boolean;
    onRestart?: () => void;
  }) => void;
}

const FeedFactory: React.FC<FeedFactoryProps> = ({ agent, onSearchStateChange }) => {
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeFeedId, setActiveFeedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Debug log to confirm component is rendering
  React.useEffect(() => {
    console.log('🔍 Search component mounted/updated');
  });

  // Use carousel hook for custom feeds
  const {
    posts,
    currentPostIndex,
    isLoading: isLoadingFeed,
    sessionStats,
    nextPost,
    prevPost,
    loadNextBatch,
    isAtSessionSummary,
    isNetworkExhausted,
  } = useCarouselFeed({
    agent,
    feedType: activeFeedId ? 'custom' : 'following',
    customFeedId: activeFeedId || undefined,
  });

  const handleSearch = async () => {
    if (!description.trim()) {
      setError('Please enter a search query');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const feed = await feedFactory.createFeedFromDescription(description);
      setActiveFeedId(feed.id);
      feedFactory.saveToStorage();
      
      // Notify parent component about the search state
      onSearchStateChange({
        query: description,
        isActive: true,
        onRestart: handleRestartSearch
      });
    } catch (error) {
      setError('Failed to search. Please try again.');
      console.error('Search error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isGenerating) {
      handleSearch();
    }
  };

  const handleRestartSearch = () => {
    setActiveFeedId(null);
    setDescription('');
    setError(null);
    
    // Notify parent component that search is no longer active
    onSearchStateChange({
      query: '',
      isActive: false
    });
  };

  const currentFeed = activeFeedId ? feedFactory.getFeed(activeFeedId) : null;

  return (
    <div className="h-full">
      {activeFeedId && currentFeed ? (
        <div className="h-full">
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
          <div className="w-full max-w-md mx-auto p-8">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🔍</div>
              <h2 className="text-2xl font-bold text-red font-serif mb-2">Search</h2>
              <p className="text-dark mb-4">
                Find posts about anything you're interested in
              </p>
            </div>

            {/* Search Bar */}
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="e.g., cat pictures, latest tech news, digital art..."
                  className="w-full p-4 text-lg border border-mocha/30 rounded-lg focus:ring-2 focus:ring-red focus:border-transparent bg-milk text-dark placeholder-coffee"
                  disabled={isGenerating}
                />
              </div>

              <button
                onClick={handleSearch}
                disabled={isGenerating || !description.trim()}
                className="w-full bg-coffee text-beige px-6 py-4 rounded-lg hover:bg-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-lg font-medium"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-beige border-t-transparent"></div>
                    <span>Searching...</span>
                  </>
                ) : (
                  <span>Search</span>
                )}
              </button>

              {error && (
                <div className="text-red text-sm bg-red/10 p-3 rounded-md text-center">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedFactory;