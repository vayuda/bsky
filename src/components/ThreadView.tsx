import React, { useState, useEffect, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "./ui/dialog";
import { MessageCircle, Heart, Repeat2 } from "lucide-react";
import { getPostThread } from "../services/bluesky";

interface ThreadViewProps {
  postUri: string;
  isOpen: boolean;
  onClose: () => void;
  originalPost: any;
}

interface ThreadPost {
  post: any;
  author: any;
  replies?: ThreadPost[];
}

const ThreadPost: React.FC<{ threadPost: ThreadPost; isRoot?: boolean }> = ({ 
  threadPost, 
  isRoot = false 
}) => {
  const { post, author } = threadPost;
  const replies = threadPost.replies || [];

  return (
    <div className={`${isRoot ? 'border-b pb-4 mb-4' : 'border-l-2 border-gray-200 pl-4 mt-3'}`}>
      <div className="flex space-x-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={author.avatar} alt={author.displayName} />
          <AvatarFallback>
            {author.displayName?.charAt(0) || author.handle.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <span className="font-semibold text-dark">
              {author.displayName || author.handle}
            </span>
            <span className="text-gray-500 text-sm">@{author.handle}</span>
            <span className="text-gray-500 text-sm">·</span>
            <span className="text-gray-500 text-sm">
              {new Date(post.indexedAt).toLocaleDateString()}
            </span>
          </div>
          <p className="text-dark mb-3 whitespace-pre-line">{post.record.text}</p>
          
          {/* Engagement stats for replies */}
          {!isRoot && (
            <div className="flex items-center space-x-6 text-gray-500">
              <div className="flex items-center space-x-1">
                <MessageCircle className="h-4 w-4" />
                <span className="text-xs">{post.replyCount || 0}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Heart className="h-4 w-4" />
                <span className="text-xs">{post.likeCount || 0}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Repeat2 className="h-4 w-4" />
                <span className="text-xs">{post.repostCount || 0}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Render replies */}
      {replies.length > 0 && (
        <div className="mt-3">
          {replies.map((reply, index) => (
            <ThreadPost 
              key={`${reply.post.uri}-${index}`} 
              threadPost={reply} 
              isRoot={false}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const ThreadView: React.FC<ThreadViewProps> = ({ 
  postUri, 
  isOpen, 
  onClose, 
  originalPost 
}) => {
  const [thread, setThread] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchThread = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const threadData = await getPostThread(postUri);
      setThread(threadData);
    } catch (err) {
      setError("Failed to load thread");
      console.error("Error fetching thread:", err);
    } finally {
      setLoading(false);
    }
  }, [postUri]);

  useEffect(() => {
    if (isOpen && postUri) {
      fetchThread();
    }
  }, [isOpen, postUri, fetchThread]);

  const formatThreadForDisplay = (threadData: any): ThreadPost | null => {
    if (!threadData || threadData.$type !== 'app.bsky.feed.defs#threadViewPost') {
      return null;
    }

    const replies = threadData.replies?.map((reply: any) => formatThreadForDisplay(reply)).filter(Boolean) || [];
    
    return {
      post: threadData.post,
      author: threadData.post.author,
      replies
    };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Thread</DialogTitle>
        </DialogHeader>
        
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading thread...</div>
          </div>
        )}
        
        {error && (
          <div className="flex items-center justify-center py-8">
            <div className="text-red-500">{error}</div>
          </div>
        )}
        
        {thread && !loading && !error && (
          <div className="space-y-4">
            {(() => {
              const formattedThread = formatThreadForDisplay(thread);
              return formattedThread ? (
                <ThreadPost threadPost={formattedThread} isRoot={true} />
              ) : (
                <div className="text-gray-500 text-center py-8">
                  No replies found
                </div>
              );
            })()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};