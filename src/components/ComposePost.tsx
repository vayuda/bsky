import React, { useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Image, Smile, MapPin, Calendar, Globe } from "lucide-react";

interface ComposePostProps {
  currentUser: {
    displayName: string;
    handle: string;
    avatar?: string;
  };
  onPost?: (text: string) => void;
}

export const ComposePost: React.FC<ComposePostProps> = ({
  currentUser,
  onPost,
}) => {
  const [text, setText] = useState("");
  const maxChars = 300;
  const remainingChars = maxChars - text.length;

  const handleSubmit = () => {
    if (text.trim() && onPost) {
      onPost(text.trim());
      setText("");
    }
  };

  const isOverLimit = remainingChars < 0;
  const isNearLimit = remainingChars <= 20;

  return (
    <Card className="border-x-0 border-t-0 border-b rounded-2xl">
      <CardContent className="p-4">
        <div className="flex space-x-3">
          <Avatar className="h-12 w-12">
            <AvatarImage
              src={currentUser.avatar}
              alt={currentUser.displayName}
            />
            <AvatarFallback className="bg-blue-500 text-white">
              {currentUser.displayName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-3">
            <div className="min-h-[80px]">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What's happening?"
                className="w-full text-xl placeholder-gray-500 bg-transparent border-none outline-none resize-none min-h-[80px]"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                {/* <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-500 hover:bg-blue-50">
                  <Image className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-500 hover:bg-blue-50">
                  <Smile className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-500 hover:bg-blue-50">
                  <MapPin className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-500 hover:bg-blue-50">
                  <Calendar className="h-5 w-5" />
                </Button> */}
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 hover:text-gray-900"
                  >
                    <Globe className="h-4 w-4 mr-1" />
                    Everyone can reply
                  </Button>
                </div>

                <div className="flex items-center space-x-3">
                  {text.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <div className="relative w-6 h-6">
                        <svg
                          className="w-6 h-6 transform -rotate-90"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                            className="text-gray-300"
                          />
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                            strokeDasharray={`${(text.length / maxChars) * 62.83} 62.83`}
                            className={`transition-colors ${
                              isOverLimit
                                ? "text-red-500"
                                : isNearLimit
                                  ? "text-yellow-500"
                                  : "text-blue-500"
                            }`}
                          />
                        </svg>
                      </div>
                      <span
                        className={`text-sm ${
                          isOverLimit
                            ? "text-red-500"
                            : isNearLimit
                              ? "text-yellow-500"
                              : "text-gray-500"
                        }`}
                      >
                        {isNearLimit ? remainingChars : ""}
                      </span>
                    </div>
                  )}

                  <Button
                    onClick={handleSubmit}
                    disabled={!text.trim() || isOverLimit}
                    className="bg-coffee hover:bg-dark text-beige font-semibold px-6"
                  >
                    Post
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
