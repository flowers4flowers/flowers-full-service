import { getGalleryData } from "../../queries/galleryQuery"
import GalleryContent from "../../components/GalleryContent"

export default async function Gallery() {
  const data = await getGalleryData()

  const { mediaItems } = data.result

  return (
    <GalleryContent mediaItems={mediaItems} />
  )
} 
