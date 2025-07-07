import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.REACT_APP_GEMINI_API_KEY || "",
);

export interface FeedSearchParams {
  keywords: string[];
  contentTypes: string[];
  searchStrategies: string[];
  hashtags: string[];
  userTypes: string[];
  requiresMedia: boolean;
  mediaType?: 'images' | 'videos' | 'any';
}

export const transformDescriptionToSearchParams = async (
  description: string,
): Promise<FeedSearchParams> => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite-preview-06-17",
    });

    const prompt = `
Transform this user description into structured search parameters for a social media feed:

Description: "${description}"

Return a JSON object with these fields:
- keywords: Array of relevant search terms (max 10)
- contentTypes: Array of content types like "news", "art", "memes", "animals", "photos", "videos", "discussions"
- searchStrategies: Array of search approaches like "hashtags", "keywords", "user_mentions", "trending"
- hashtags: Array of relevant hashtags without # symbol (max 8)
- userTypes: Array of user types to prioritize like "journalists", "artists", "photographers", "experts", "verified"
- requiresMedia: Boolean - true if user specifically requests images/photos/pictures/videos/media
- mediaType: String - "images" for photos/pictures, "videos" for video content, "any" for either

Examples:
"latest tech news" → {"keywords": ["technology", "tech", "news", "innovation"], "contentTypes": ["news"], "searchStrategies": ["hashtags", "keywords"], "hashtags": ["tech", "technology", "news"], "userTypes": ["journalists", "tech"], "requiresMedia": false}

"cat pictures" → {"keywords": ["cats", "cat", "kitten", "feline"], "contentTypes": ["photos", "animals"], "searchStrategies": ["hashtags", "keywords"], "hashtags": ["cats", "cat", "pets", "animals"], "userTypes": ["photographers"], "requiresMedia": true, "mediaType": "images"}

"digital art" → {"keywords": ["digital art", "art", "illustration", "design"], "contentTypes": ["art", "photos"], "searchStrategies": ["hashtags", "keywords"], "hashtags": ["digitalart", "art", "illustration", "design"], "userTypes": ["artists"], "requiresMedia": true, "mediaType": "images"}

"funny memes" → {"keywords": ["memes", "funny", "humor", "comedy"], "contentTypes": ["memes", "photos"], "searchStrategies": ["hashtags", "trending"], "hashtags": ["memes", "funny", "humor"], "userTypes": [], "requiresMedia": false}

"videos of dogs" → {"keywords": ["dogs", "dog", "puppy", "canine"], "contentTypes": ["videos", "animals"], "searchStrategies": ["hashtags", "keywords"], "hashtags": ["dogs", "dog", "pets", "animals"], "userTypes": [], "requiresMedia": true, "mediaType": "videos"}

Return only the JSON object, no other text.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    try {
      // Strip markdown code blocks if present
      const cleanText = text.replace(/```json\s*|\s*```/g, '').trim();
      return JSON.parse(cleanText);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", text);
      // Fallback to basic keyword extraction
      return extractBasicKeywords(description);
    }
  } catch (error) {
    console.error("Gemini API error:", error);
    // Fallback to basic keyword extraction
    return extractBasicKeywords(description);
  }
};

// Fallback function for when Gemini is unavailable
const extractBasicKeywords = (description: string): FeedSearchParams => {
  console.log("Gemini unavailable, falling back to basic kewords");
  const words = description.toLowerCase().split(/\s+/);

  // Basic content type mapping
  const contentTypeMap: Record<string, string[]> = {
    news: ["news", "breaking", "latest", "update"],
    art: ["art", "drawing", "painting", "illustration", "design"],
    memes: ["meme", "memes", "funny", "humor", "comedy"],
    animals: ["cat", "dog", "animal", "pet", "wildlife"],
    photos: ["photo", "picture", "image", "photography"],
  };

  const contentTypes: string[] = [];
  const keywords = words.filter((word) => word.length > 2);

  // Detect content types
  Object.entries(contentTypeMap).forEach(([type, triggers]) => {
    if (
      triggers.some((trigger) => description.toLowerCase().includes(trigger))
    ) {
      contentTypes.push(type);
    }
  });

  // Basic visual content detection
  const visualKeywords = ['picture', 'image', 'photo', 'video', 'clip', 'visual'];
  const requiresMedia = visualKeywords.some(keyword => description.toLowerCase().includes(keyword));
  const mediaType = description.toLowerCase().includes('video') || description.toLowerCase().includes('clip') ? 'videos' : 'images';

  return {
    keywords: keywords.slice(0, 10),
    contentTypes: contentTypes.length > 0 ? contentTypes : ["general"],
    searchStrategies: ["keywords", "hashtags"],
    hashtags: keywords.slice(0, 5),
    userTypes: [],
    requiresMedia,
    mediaType: requiresMedia ? mediaType : undefined,
  };
};
