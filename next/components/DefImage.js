// next/components/DefImage.js

"use client";

import Image from "next/image";
import { useState } from "react";

const DefImage = ({ src, alt, style, width, height, className }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <Image
      src={src}
      alt={alt}
      style={style}
      className={`def-image ${loaded ? "loaded" : false} ${className}`}
      onLoad={() => {
        setLoaded(true);
      }}
      width={width}
      height={height}
    />
  );
};

export default DefImage;
