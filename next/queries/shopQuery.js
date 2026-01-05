

// next/queries/shopQuery.js

export async function getShopData() {
  const res = await fetch(process.env.API_HOST, {
    cache: 'no-store',
    method: 'POST',
    headers: {
      Authorization: `Basic ${process.env.AUTH}`,
    },
    body: JSON.stringify({
      query: `site.find('shop')`,
      select: {
        text: {
          query: 'page.text.kirbyText'
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