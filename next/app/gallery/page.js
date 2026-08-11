// next/app/gallery/page.js

import { getGalleryData } from "../../styles/queries/galleryQuery";
import GalleryContent from "../../components/GalleryContent";

export const metadata = {
  alternates: {
    canonical: "https://www.flowersfullservice.art/gallery",
  },
};

export default async function Gallery() {
  const data = await getGalleryData();

  const { mediaItems } = data.result;

  return <GalleryContent mediaItems={mediaItems} />;
}
