// next/components/DefImage.js

"use client";

import Image from "next/image";

const DefImage = ({ src, alt, style, width, height, className, priority, sizes }) => {
  return (
    <Image
      src={src}
      alt={alt}
      style={style}
      className={`def-image ${className}`}
      width={width}
      height={height}
      priority={priority}
      sizes={sizes}
    />
  );
};

export default DefImage;
