// next/queries/homeQuery.js

export async function getHomeData() {
  const res = await fetch(process.env.API_HOST, {
    cache: "no-store",
    method: "POST",
    headers: {
      Authorization: `Basic ${process.env.AUTH}`,
    },
    body: JSON.stringify({
      query: `site.find('home')`,
      select: {
        description: {
          query: "page.description.kirbyText",
        },
        carouselImages: {
          query: "page.carousel_images.toFiles",
          select: {
            url: true,
            width: true,
            height: true,
            alt: true,
          },
        },
      },
    }),
  });

  // Handle errors
  if (!res.ok) {
    throw new Error("Failed to fetch data");
  }

  return res.json();
}
