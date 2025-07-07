import React, { useState } from 'react';

interface PostImage {
  thumb: string;
  fullsize: string;
  alt: string;
  aspectRatio?: {
    width: number;
    height: number;
  };
}

interface PostImagesProps {
  images: PostImage[];
}

export const PostImages: React.FC<PostImagesProps> = ({ images }) => {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [errorImages, setErrorImages] = useState<Set<string>>(new Set());

  const handleImageLoad = (src: string) => {
    setLoadedImages(prev => new Set(prev).add(src));
  };

  const handleImageError = (src: string) => {
    setErrorImages(prev => new Set(prev).add(src));
  };

  if (!images || images.length === 0) {
    return null;
  }

  const getImageGridClass = (count: number, index: number) => {
    switch (count) {
      case 1:
        return 'col-span-2 row-span-2';
      case 2:
        return 'col-span-1 row-span-2';
      case 3:
        if (index === 0) return 'col-span-1 row-span-2';
        return 'col-span-1 row-span-1';
      case 4:
        return 'col-span-1 row-span-1';
      default:
        return 'col-span-1 row-span-1';
    }
  };

  const getAspectRatio = (image: PostImage, count: number, index: number) => {
    // Use provided aspect ratio or calculate based on layout
    if (image.aspectRatio) {
      const ratio = image.aspectRatio.height / image.aspectRatio.width;
      return ratio;
    }
    
    // Default aspect ratios based on grid position
    if (count === 1) return 0.6; // 16:10 for single images
    if (count === 2) return 1.2; // Slightly taller for two-column
    if (count === 3 && index === 0) return 1.2; // Left image in 3-grid
    return 1; // Square for small grid items
  };

  const gridClass = images.length === 1 
    ? 'grid grid-cols-1' 
    : images.length === 2 
    ? 'grid grid-cols-2 gap-1' 
    : 'grid grid-cols-2 grid-rows-2 gap-1';

  return (
    <div className={`${gridClass} rounded-lg overflow-hidden bg-gray-100 my-3`}>
      {images.slice(0, 4).map((image, index) => {
        const aspectRatio = getAspectRatio(image, images.length, index);
        const isLoaded = loadedImages.has(image.thumb);
        const hasError = errorImages.has(image.thumb);
        
        return (
          <div 
            key={index}
            className={`relative overflow-hidden bg-gray-200 ${getImageGridClass(images.length, index)}`}
            style={{ 
              aspectRatio: `1 / ${aspectRatio}`,
              minHeight: images.length === 1 ? '300px' : '150px'
            }}
          >
            {!hasError ? (
              <>
                {/* Loading placeholder */}
                {!isLoaded && (
                  <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                
                {/* Actual image */}
                <img
                  src={image.thumb}
                  alt={image.alt}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    isLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  onLoad={() => handleImageLoad(image.thumb)}
                  onError={() => handleImageError(image.thumb)}
                  loading="lazy"
                />
                
                {/* Show remaining count for 4+ images */}
                {images.length > 4 && index === 3 && (
                  <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
                    <span className="text-white text-lg font-semibold">
                      +{images.length - 4}
                    </span>
                  </div>
                )}
              </>
            ) : (
              /* Error state */
              <div className="absolute inset-0 bg-gray-300 flex items-center justify-center">
                <div className="text-gray-500 text-center">
                  <div className="text-2xl mb-1">🖼️</div>
                  <div className="text-xs">Image unavailable</div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};