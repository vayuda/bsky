import React, { useState, useEffect, useCallback } from "react";
import { getUserProfile, followUser, unfollowUser } from "../services/bluesky";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface UserProfileProps {
  userHandle: string;
  isOpen: boolean;
  onClose: () => void;
}

interface UserProfileData {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  viewer?: {
    following?: string;
    followedBy?: string;
  };
}

export const UserProfile: React.FC<UserProfileProps> = ({
  userHandle,
  isOpen,
  onClose,
}) => {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const fetchUserProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profileData = await getUserProfile(userHandle);
      setProfile(profileData);
      setIsFollowing(!!profileData.viewer?.following);
    } catch (err) {
      setError("Failed to load user profile");
      console.error("Error fetching user profile:", err);
    } finally {
      setLoading(false);
    }
  }, [userHandle]);

  useEffect(() => {
    if (isOpen && userHandle) {
      fetchUserProfile();
    }
  }, [isOpen, userHandle, fetchUserProfile]);

  const handleFollowToggle = async () => {
    if (!profile) return;

    setFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(profile.did);
        setIsFollowing(false);
      } else {
        await followUser(profile.did);
        setIsFollowing(true);
      }
    } catch (err) {
      console.error("Error toggling follow:", err);
      setError("Failed to update follow status");
    } finally {
      setFollowLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-milk border-coffee">
        <DialogHeader>
          <DialogTitle className="text-coffee">User Profile</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-coffee">Loading profile...</div>
          </div>
        )}

        {error && <div className="text-red-600 text-center py-4">{error}</div>}

        {profile && !loading && (
          <div className="space-y-4">
            <div className="flex items-start space-x-4">
              <Avatar className="w-16 h-16">
                <AvatarImage
                  src={profile.avatar}
                  alt={profile.displayName || profile.handle}
                />
                <AvatarFallback className="bg-beige text-coffee">
                  {(profile.displayName || profile.handle)
                    .charAt(0)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-coffee">
                  {profile.displayName || profile.handle}
                </h3>
                <p className="text-sm text-coffee/70">@{profile.handle}</p>

                <div className="flex space-x-4 mt-2 text-sm text-coffee/80">
                  <span>
                    {formatNumber(profile.followersCount || 0)} followers
                  </span>
                  <span>
                    {formatNumber(profile.followsCount || 0)} following
                  </span>
                  <span>{formatNumber(profile.postsCount || 0)} posts</span>
                </div>
              </div>
            </div>

            {profile.description && (
              <div className="text-coffee">
                <p className="text-sm leading-relaxed">{profile.description}</p>
              </div>
            )}

            <div className="flex space-x-2 pt-4">
              <Button
                onClick={handleFollowToggle}
                disabled={followLoading}
                variant={isFollowing ? "outline" : "default"}
                className={`flex-1 ${
                  isFollowing
                    ? "border-coffee text-coffee hover:bg-coffee/10"
                    : "bg-coffee text-milk hover:bg-coffee/90"
                }`}
              >
                {followLoading ? "..." : isFollowing ? "Unfollow" : "Follow"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
