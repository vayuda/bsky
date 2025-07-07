import React, { useRef, useEffect } from 'react';
import { Post } from './Post';

interface VirtualPostProps {
  id: string;
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
  isLiked: boolean;
  isReposted: boolean;
  labels: string[];
  networkContext?: {
    via: string;
    weight: number;
  };
  onRegister: (id: string, element: HTMLElement | null) => void;
}

export const VirtualPost: React.FC<VirtualPostProps> = ({
  id,
  onRegister,
  ...postProps
}) => {
  const postRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onRegister(id, postRef.current);
    
    return () => {
      onRegister(id, null);
    };
  }, [id, onRegister]);

  return (
    <div ref={postRef} data-post-id={id}>
      <Post id={id} {...postProps} />
    </div>
  );
};