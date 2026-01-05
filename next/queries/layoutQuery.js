

// next/queries/layoutQuery.js

export async function getGlobalData() {
  const res = await fetch(process.env.API_HOST, {
    cache: 'no-store',
    method: 'POST',
    headers: {
      Authorization: `Basic ${process.env.AUTH}`,
    },
    body: JSON.stringify({
      query: 'site',
      select: {
        socialLinks: {
          query: 'site.social_links.toStructure',
          select: {
            title: true,
            link: true,
          }
        },
        screensaverImages: {
          query: 'site.screensaver_images.toFiles',
          select: {
            url: true,
            width: true,
            height: true,
            alt: true,
          }
        }
      }
    })
  })
 
  // Handle errors
  if (!res.ok) {
    throw new Error('Failed to fetch data')
  }
 
  return res.json()
}