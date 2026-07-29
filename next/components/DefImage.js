// next/components/DefImage.js

"use client";

import Image from "next/image";

const DefImage = ({ src, alt, style, width, height, className }) => {
  return (
    <Image
      src={src}
      alt={alt}
      style={style}
      className={`def-image ${className}`}
      width={width}
      height={height}
    />
  );
};

export default DefImage;
