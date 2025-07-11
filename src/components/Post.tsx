import React, { useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { PostImages } from "./PostImages";
import { ThreadView } from "./ThreadView";
import { UserProfile } from "./UserProfile";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Share,
  MoreHorizontal,
  Shield,
} from "lucide-react";

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

interface PostProps {
  id: string;
  uri: string;
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
  isLiked?: boolean;
  isReposted?: boolean;
  labels?: string[];
  embed?: PostEmbed;
  networkContext?: {
    via: string;
    weight: number;
  };
  isInCarousel?: boolean;
}

export const Post: React.FC<PostProps> = ({
  uri,
  author,
  text,
  createdAt,
  likeCount,
  replyCount,
  repostCount,
  isLiked = false,
  isReposted = false,
  labels = [],
  embed,
  networkContext,
  isInCarousel = false,
}) => {
  const [threadOpen, setThreadOpen] = useState(false);
  const [showCopyMessage, setShowCopyMessage] = useState(false);
  const [userProfileOpen, setUserProfileOpen] = useState(false);

  const handleCommentsClick = () => {
    if (replyCount > 0) {
      setThreadOpen(true);
    }
  };

  const handleShareClick = async () => {
    const postUrl = `https://bsky.app/profile/${author.handle}/post/${uri.split('/').pop()}`;
    
    try {
      await navigator.clipboard.writeText(postUrl);
      setShowCopyMessage(true);
      setTimeout(() => setShowCopyMessage(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUserProfileOpen(true);
  };

  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700 underline"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60),
    );

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60),
      );
      return `${diffInMinutes}m`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d`;
    }
  };

  if (isInCarousel) {
    return (
      <div className="p-4">
        <div className="flex space-x-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={author.avatar} alt={author.displayName} />
            <AvatarFallback className="bg-blue-500 text-white">
              {author.displayName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <h3 
                    className="font-semibold text-sm hover:underline cursor-pointer"
                    onClick={handleUserClick}
                  >
                    {author.displayName}
                  </h3>
                  {author.verified && (
                    <Shield className="h-4 w-4 text-blue-500 fill-current" />
                  )}
                </div>
                <span 
                  className="text-gray-500 text-sm hover:underline cursor-pointer"
                  onClick={handleUserClick}
                >
                  @{author.handle}
                </span>
                <span className="text-gray-500 text-sm">·</span>
                <span className="text-gray-500 text-sm">
                  {formatTime(createdAt)}
                </span>
                {networkContext && (
                  <>
                    <span className="text-gray-500 text-sm">·</span>
                    <span className="text-xs text-white bg-red px-2 py-1 rounded-full">
                      via {networkContext.via}
                    </span>
                  </>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-gray-100"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>

            <div className="text-sm leading-relaxed">{renderTextWithLinks(text)}</div>

            {/* Render images if present */}
            {embed?.images && embed.images.length > 0 && (
              <PostImages images={embed.images} />
            )}

            {labels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {labels.map((label, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between max-w-md pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center space-x-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 -ml-2 px-2"
                onClick={handleCommentsClick}
                disabled={replyCount === 0}
              >
                <MessageCircle className="h-4 w-4" />
                {replyCount > 0 && (
                  <span className="text-xs">{replyCount}</span>
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className={`flex items-center space-x-2 hover:bg-green-50 px-2 ${
                  isReposted
                    ? "text-green-600"
                    : "text-gray-500 hover:text-green-600"
                }`}
              >
                <Repeat2 className="h-4 w-4" />
                {repostCount > 0 && (
                  <span className="text-xs">{repostCount}</span>
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className={`flex items-center space-x-2 hover:bg-red-50 px-2 ${
                  isLiked ? "text-red-500" : "text-gray-500 hover:text-red-500"
                }`}
              >
                <Heart className={`h-4 w-4 ${isLiked ? "fill-current" : ""}`} />
                {likeCount > 0 && <span className="text-xs">{likeCount}</span>}
              </Button>

              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-blue-500 hover:bg-blue-50 px-2"
                  onClick={handleShareClick}
                >
                  <Share className="h-4 w-4" />
                </Button>
                {showCopyMessage && (
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    Link copied to clipboard
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <ThreadView
          postUri={uri}
          isOpen={threadOpen}
          onClose={() => setThreadOpen(false)}
          originalPost={{ uri, author, text, createdAt, likeCount, replyCount, repostCount }}
        />
        
        <UserProfile
          userHandle={author.handle}
          isOpen={userProfileOpen}
          onClose={() => setUserProfileOpen(false)}
        />
      </div>
    );
  }

  return (
    <Card className="border-0 rounded-lg transition-colors cursor-pointer mb-4">
      <CardContent className="p-4">
        <div className="flex space-x-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={author.avatar} alt={author.displayName} />
            <AvatarFallback className="bg-blue-500 text-white">
              {author.displayName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <h3 
                    className="font-semibold text-sm hover:underline cursor-pointer"
                    onClick={handleUserClick}
                  >
                    {author.displayName}
                  </h3>
                  {author.verified && (
                    <Shield className="h-4 w-4 text-blue-500 fill-current" />
                  )}
                </div>
                <span 
                  className="text-gray-500 text-sm hover:underline cursor-pointer"
                  onClick={handleUserClick}
                >
                  @{author.handle}
                </span>
                <span className="text-gray-500 text-sm">·</span>
                <span className="text-gray-500 text-sm">
                  {formatTime(createdAt)}
                </span>
                {networkContext && (
                  <>
                    <span className="text-gray-500 text-sm">·</span>
                    <span className="text-xs text-white bg-red px-2 py-1 rounded-full">
                      via {networkContext.via}
                    </span>
                  </>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-gray-100"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>

            <div className="text-sm leading-relaxed">{renderTextWithLinks(text)}</div>

            {/* Render images if present */}
            {embed?.images && embed.images.length > 0 && (
              <PostImages images={embed.images} />
            )}

            {labels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {labels.map((label, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between max-w-md pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center space-x-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 -ml-2 px-2"
                onClick={handleCommentsClick}
                disabled={replyCount === 0}
              >
                <MessageCircle className="h-4 w-4" />
                {replyCount > 0 && (
                  <span className="text-xs">{replyCount}</span>
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className={`flex items-center space-x-2 hover:bg-green-50 px-2 ${
                  isReposted
                    ? "text-green-600"
                    : "text-gray-500 hover:text-green-600"
                }`}
              >
                <Repeat2 className="h-4 w-4" />
                {repostCount > 0 && (
                  <span className="text-xs">{repostCount}</span>
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className={`flex items-center space-x-2 hover:bg-red-50 px-2 ${
                  isLiked ? "text-red-500" : "text-gray-500 hover:text-red-500"
                }`}
              >
                <Heart className={`h-4 w-4 ${isLiked ? "fill-current" : ""}`} />
                {likeCount > 0 && <span className="text-xs">{likeCount}</span>}
              </Button>

              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-blue-500 hover:bg-blue-50 px-2"
                  onClick={handleShareClick}
                >
                  <Share className="h-4 w-4" />
                </Button>
                {showCopyMessage && (
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    Link copied to clipboard
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <ThreadView
          postUri={uri}
          isOpen={threadOpen}
          onClose={() => setThreadOpen(false)}
          originalPost={{ uri, author, text, createdAt, likeCount, replyCount, repostCount }}
        />
        
        <UserProfile
          userHandle={author.handle}
          isOpen={userProfileOpen}
          onClose={() => setUserProfileOpen(false)}
        />
      </CardContent>
    </Card>
  );
};
