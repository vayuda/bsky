# Bluesky Social Media Client

A mindful, non-predatory social media client for the Bluesky AT Protocol network built with React 19 and TypeScript. This application prioritizes intentional consumption over infinite scrolling and click data farming, featuring advanced content curation through the **Feed Factory** system.

## 🎯 Project Philosophy

This client is designed to promote healthy social media habits by:
- **No infinite scrolling** - Deliberate 10-post batches with session summaries
- **Mindful consumption** - Session tracking with reflection prompts
- **User control** - No algorithmic manipulation, only content you choose to see
- **Intentional navigation** - Keyboard-driven carousel interface
- **Quality-first content** - Advanced engagement-based filtering for high-quality posts

## 🏭 Feed Factory System

### **Custom Feed Creation**
The Feed Factory allows users to create personalized feeds using natural language descriptions or pre-built templates.

#### **How It Works**
1. **Natural Language Input**: Users describe desired content (e.g., "cat photos", "tech news", "digital art")
2. **AI Transformation**: Gemini AI converts descriptions to search parameters
3. **Multi-Strategy Search**: System searches Bluesky using keywords, hashtags, and content types
4. **Quality Filtering**: Advanced engagement-based filtering surfaces high-quality content
5. **Smart Pagination**: Automatic loading of fresh content with deduplication

#### **Pre-Built Templates**
- **Tech News**: Technology and startup news with verified engagement
- **Cat Content**: High-quality cat photos and videos
- **Digital Art**: Curated digital artwork and illustrations
- **Memes**: Popular humor content with proven engagement
- **Wildlife**: Nature photography from established photographers

### **Content Quality Rating System**

#### **Engagement-Based Prioritization**
The system uses sophisticated scoring to surface proven, high-quality content:

**High-Quality Tier** (Primary Focus):
- **Criteria**: Replies ≥ 3 AND Likes ≥ 5
- **Base Bonus**: +50 points
- **Author Credibility Bonus**:
  - +25 points for authors with ≥100 followers
  - +10 points for authors with ≥10 followers

**Medium Quality Tier**:
- **Criteria**: Replies ≥ 2 AND Likes ≥ 3
- **Base Bonus**: +20 points
- **Author Bonus**: +10 points for ≥50 followers

**Minimal Engagement**:
- **Criteria**: Likes ≥ 2
- **Bonus**: +5 points

#### **Recency Sweet Spot Algorithm**
Unlike traditional algorithms that favor brand new content, our system prioritizes "verified" content:

- **< 1 day**: 5 points (too new, unverified engagement)
- **1-3 days**: 15 points (good verification time)
- **3-7 days**: 20 points (optimal - peak verification period)
- **7-14 days**: 15 points (still relevant)
- **2-4 weeks**: 8 points (declining relevance)
- **> 1 month**: 2 points (low priority)

This approach ensures content has had time to accumulate genuine engagement signals.

#### **Quality Filters**

**Content Filtering**:
- Text length minimum (10+ characters)
- Hashtag spam detection (rejects >40% hashtag content)
- Media requirements (when specified)
- Zero-engagement filtering (except for media posts)

**Author Credibility**:
- Smart follower data fetching for high-engagement posts
- Rate-limited API calls to avoid abuse
- Graceful fallback when follower data unavailable

### **Feed Factory Technical Implementation**

#### **Search Strategy Rotation**
The system uses three distinct search strategies for content diversity:
1. **Broader Keywords**: Fewer, more general terms for wider reach
2. **Hashtag-Focused**: Emphasis on hashtag discovery
3. **Mixed Approach**: Keyword/hashtag combination with relaxed media requirements

#### **Progressive Loading**
- Initial generation: 100 posts (up from 30)
- Automatic refilling when <20 fresh posts remain
- Maximum 500 posts per feed to prevent memory issues
- 30-second rate limiting between fresh searches

#### **Deduplication System**
- Feed-specific `Set<string>` tracking shown post URIs
- Global deduplication across all feeds
- Persistent localStorage with Set restoration
- Never shows duplicate content

#### **Smart Author Data Enrichment**
To optimize API usage while maximizing quality:
- Only fetches follower counts for posts meeting high engagement criteria
- Processes top 10 high-engagement posts per batch
- Batched requests (3 at a time) with 500ms delays
- Rate-limited to prevent API abuse

## 🏗️ Architecture Overview

### Core Technologies
- **React 19** with TypeScript and Create React App
- **Tailwind CSS** for styling with **Radix UI** components
- **@atproto/api** for Bluesky integration
- **Gemini AI** for natural language processing
- **PostCarousel** navigation instead of infinite scroll

### Directory Structure
```
src/
├── components/
│   ├── ui/                 # Base UI components (shadcn/ui pattern)
│   ├── Login.tsx          # Authentication component
│   ├── Post.tsx           # Individual post display with image support
│   ├── PostImages.tsx     # Smart image grid layouts (1-4 images)
│   ├── PostCarousel.tsx   # Carousel navigation system
│   ├── FeedFactory.tsx    # Custom feed creation interface
│   ├── ComposePost.tsx    # Post creation interface
│   └── SessionSummary.tsx # Batch completion summary
├── hooks/
│   ├── useCarouselFeed.ts # Feed management with carousel logic
│   └── useVirtualFeed.ts  # Virtual scrolling for performance
├── services/
│   ├── bluesky.ts         # API layer with advanced caching
│   ├── feedFactory.ts     # Custom feed generation and management
│   └── gemini.ts          # AI-powered search parameter generation
└── lib/                   # Utilities
```

## 🎮 User Interface

### Feed Types

1. **Following Feed** (`/following`)
   - Posts from people you follow
   - Standard timeline experience
   - Post composition available

2. **Network Feed** (`/discover`) 
   - Posts from followers-of-followers
   - Discovers content through your network
   - Advanced caching for performance

3. **Popular Feed** (`/popular`)
   - Curated popular content
   - Uses Bluesky's algorithm feed

4. **Custom Feed** (`/custom`) - **Feed Factory**
   - User-created feeds from natural language descriptions
   - Template-based feed creation
   - Advanced content quality filtering
   - Unlimited fresh content with smart pagination

### Post Display Features

#### **Image Rendering**
- Smart grid layouts for 1-4 images per post
- Aspect ratio preservation with lazy loading
- Error handling and fallback states
- Support for AT Protocol embed format

#### **Carousel Navigation**
- **10 posts per batch** - No endless scrolling
- **Right arrow key** - Navigate to next post
- **Left arrow key** - Navigate to previous post
- **Progress indicator** - Shows position in batch
- **Session summary** - Stats and reflection after each batch

### Session Tracking

Each batch tracks:
- **Posts viewed** - Count of posts seen
- **Time spent** - Duration of session
- **Batch number** - Current batch in session
- **Mindful pause** - Reflection prompt between batches

## 🔄 Caching System

### Two-Layer Hybrid Cache Architecture

The app implements a sophisticated caching system to minimize API requests and improve performance:

#### **Layer 1: In-Memory Cache (RAM)**
- **Storage**: JavaScript variables in browser memory
- **Lifetime**: Active tab session only
- **Speed**: Instant access
- **Purpose**: Working data for current session

#### **Layer 2: Persistent Cache (localStorage)**
- **Storage**: Browser's localStorage
- **Lifetime**: Survives browser restarts
- **Speed**: Fast local access
- **Purpose**: Preserve network data across sessions

### Cache Flow
```
App Start → RAM Cache → localStorage → Bluesky API
           (instant)   (fast)        (slow, cached)
```

### What Gets Cached

1. **Following List** (2-hour TTL)
   - Users you follow
   - Prevents repeated follows API calls

2. **Network Graph** (4-hour TTL)
   - Followers-of-followers connections
   - Complex relationship mapping

3. **Individual User Followers** (2-hour TTL)
   - Followers for each person you follow
   - Granular relationship data

4. **Custom Feeds** (Persistent)
   - Feed definitions and search parameters
   - Shown post tracking for deduplication
   - Progressive loading state

### Cache Inspection Tools

Access these in your browser's Developer Console:

```javascript
// Quick statistics
getCacheStats()

// Detailed cache contents
inspectCache()

// Clear all caches
clearCache()

// Direct cache access
blueskyCache

// Feed Factory specific
feedFactory.getFeedStats(feedId)  // Get feed statistics
feedFactory.resetFeedProgress(feedId)  // Reset shown posts
```

## 🔧 Development

### Commands

```bash
npm start    # Development server (http://localhost:3000)
npm test     # Run tests in watch mode  
npm run build # Create production build
npm run eject # Eject from Create React App (irreversible)
```

### Key Patterns

1. **Service Layer**: All Bluesky API calls go through `src/services/bluesky.ts`
2. **Feed Factory**: Custom feed generation in `src/services/feedFactory.ts`
3. **Carousel Feed**: The `useCarouselFeed` hook manages batched loading
4. **Virtual Scrolling**: Performance optimization for large feeds
5. **Component Library**: Uses shadcn/ui pattern with Radix UI primitives
6. **TypeScript Strict Mode**: Full type safety with path aliases (`@/*` → `./src/*`)

## 🎯 Performance Optimizations

### Feed Factory Optimizations
- **Search Strategy Rotation**: Prevents repetitive content
- **Smart Rate Limiting**: 30-second intervals between fresh searches
- **Batch Processing**: 3 author profile requests at a time
- **Selective Enhancement**: Only fetch follower data for high-engagement posts
- **Memory Management**: Maximum 500 posts per feed

### Network Discovery Optimizations
- **Reduced batch sizes**: 3 users per API batch (down from 5)
- **Sequential requests**: Prevents API rate limiting
- **Intelligent delays**: 1.5s between batches, 200ms between posts
- **Caching strategy**: Multi-layer cache reduces API calls by 95%

### API Request Reduction
- **Before optimization**: 80-100+ API calls per batch
- **After optimization**: 
  - First load: ~30 API calls (cached for hours)
  - Subsequent loads: ~10 API calls (posts only)
  - Cache hits: 0 API calls

## 🎛️ Configuration

### Feed Factory Configuration
```typescript
// Quality thresholds
const HIGH_QUALITY_THRESHOLD = { replies: 3, likes: 5 };
const MEDIUM_QUALITY_THRESHOLD = { replies: 2, likes: 3 };

// Author credibility levels
const ESTABLISHED_AUTHOR = 100; // followers
const DECENT_FOLLOWING = 10;    // followers

// Progressive loading settings
const MIN_FRESH_POSTS = 20;
const MAX_TOTAL_POSTS = 500;
const SEARCH_COOLDOWN = 30000; // 30 seconds
```

### Cache Configuration
```typescript
const NETWORK_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours
const FOLLOWERS_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours
const MAX_NETWORK_SIZE = 1000; // Max network connections
```

## 🔍 Debugging & Development Tools

### Feed Factory Debugging
```javascript
// Feed statistics
feedFactory.getFeedStats('feed_id')
// Returns: { totalPosts, shownPosts, availablePosts }

// Reset feed progress
feedFactory.resetFeedProgress('feed_id')

// Get all feeds
feedFactory.getAllFeeds()
```

### Cache Inspection
```javascript
// Browser console commands available:
getCacheStats()  // Shows cache sizes and ages
inspectCache()   // Detailed cache contents
clearCache()     // Reset all caches
```

### localStorage Inspection
1. Open Developer Tools (F12)
2. Navigate to **Application** > **Storage** > **Local Storage**
3. Look for entries:
   - `bluesky_network_cache_<user-id>` (Network cache)
   - `custom_feeds` (Feed Factory data)

## 🚀 Getting Started

1. **Clone and install**:
   ```bash
   git clone <repository>
   cd bsky
   npm install
   ```

2. **Start development**:
   ```bash
   npm start
   ```

3. **Create Bluesky app password**:
   - Go to Bluesky Settings > App Passwords
   - Create new app password
   - Use this (not your main password) to log in

4. **First time usage**:
   - Network feed will take time to build cache initially
   - Feed Factory requires login to create custom feeds
   - Use templates for quick feed creation
   - Custom feeds improve with more search data

## 📱 Usage Patterns

### Feed Factory Usage
1. **Template-Based**: Select pre-built template for instant high-quality feeds
2. **Natural Language**: Describe desired content in plain English
3. **Iterative Refinement**: Feeds improve quality over time with more searches
4. **Progressive Loading**: Fresh content loads automatically as you consume

### Mindful Consumption
- Each batch is limited to 10 posts
- Session summary encourages reflection
- No infinite scroll to prevent mindless browsing
- Keyboard navigation requires intentional action
- Quality-first content reduces noise

### Cache Management
- Cache builds automatically on first Network feed access
- Feed Factory maintains persistent feed state
- Refresh cache when following new people
- Monitor cache stats for debugging

## 🔒 Privacy & Data

- **No data collection**: App doesn't track user behavior
- **Local storage only**: Cache data stays on your device
- **Bluesky API**: Standard AT Protocol authentication
- **No analytics**: No third-party tracking or metrics
- **AI Processing**: Feed descriptions processed by Gemini AI (privacy: query only, no storage)

## 🤝 Contributing

Key areas for improvement:
- Additional Feed Factory templates
- Enhanced content quality algorithms
- Mobile responsive improvements
- Accessibility enhancements
- Performance optimizations
- Advanced filtering options

---

Built with ❤️ for mindful social media consumption and intelligent content curation.