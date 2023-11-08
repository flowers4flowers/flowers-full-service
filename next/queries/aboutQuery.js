export async function getAboutData() {
  const aboutRes = await fetch(process.env.API_HOST, {
    cache: 'no-store',
    method: 'POST',
    headers: {
      Authorization: `Basic ${process.env.AUTH}`,
    },
    body: JSON.stringify({
      query: `site.find('about')`,
      select: {
        description: {
          query: 'page.description.kirbyText'
        }
      }
    })
  })
 
  // Handle errors
  if (!aboutRes.ok) {
    throw new Error('Failed to fetch data')
  }

  const aboutData = await aboutRes.json()

  const clientsRes = await fetch(process.env.API_HOST, {
    cache: 'no-store',
    method: 'POST',
    headers: {
      Authorization: `Basic ${process.env.AUTH}`,
    },
    body: JSON.stringify({
      query: `site`,
      select: {
        clients: {
          query: 'site.clients.toStructure',
          select: {
            name: true
          }
        }
      }
    })
  })
 
  // Handle errors
  if (!clientsRes.ok) {
    throw new Error('Failed to fetch data')
  }

  const clientsData = await clientsRes.json()

  const projectsRes = await fetch(process.env.API_HOST, {
    cache: 'no-store',
    method: 'POST',
    headers: {
      Authorization: `Basic ${process.env.AUTH}`,
    },
    body: JSON.stringify({
      query: `page('Projects')`,
      select: {
        projects: {
          query: 'page.children',
          select: {
            title: true,
            slug: true,
            client: true,
            date: `page.date.toDate('Y')`,
            location: true,
            description: {
              query: 'page.description.kirbyText'
            },
            featuredImage: {
              query: 'page.featured_image.toFile',
              select: {
                url: true,
                width: true,
                height: true,
                alt: true
              }
            },
          }
        }
      }
    })
  })

  if (!projectsRes.ok) {
    throw new Error('Failed to fetch data')
  }

  const projectsData = await projectsRes.json()

  return {
    aboutData,
    projectsData,
    clientsData
  }
}