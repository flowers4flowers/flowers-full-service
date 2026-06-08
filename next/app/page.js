// next/app/page.js

import { getHomeData } from "../queries/homeQuery";
import HomeContent from "../components/HomeContent";

export const metadata = {
  alternates: {
    canonical: "https://www.flowersfullservice.art",
  },
};

export default async function Home() {
  const data = await getHomeData();

  const { description, carouselImages } = data.result;

  return (
    <HomeContent description={description} carouselImages={carouselImages} />
  );
}
