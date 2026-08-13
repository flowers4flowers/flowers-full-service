// next/components/MediaItem.js

import DefImage from "./DefImage";
import VideoPlayer from "./VideoPlayer";

const MediaItem = ({ media }) => {
  if (media.videoMp4 || media.vimeoUrl) {
    return <VideoPlayer block={media} className="media-item" />;
  }

  return (
    <div className="media-item">
      <DefImage
        src={media.media.url}
        alt={media.media.alt}
        width={media.media.width}
        height={media.media.height}
        className="w-full h-auto"
      />

      {media.caption && (
        <p className="media-caption text-md lg:text-center text-base font-secondary mt-4 lg:mt-5">
          {media.caption}
        </p>
      )}
    </div>
  );
};

export default MediaItem;
