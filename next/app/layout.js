import '@/styles/global.css'
import { AppWrapper } from '@/context'
import MainNav from '@/components/MainNav'
import HomeLink from '@/components/HomeLink'
import Screensaver from '@/components/Screensaver'
import { getGlobalData } from '@/queries/layoutQuery'

/*
----------
COMPONENT LOGIC
----------
*/

export default async function RootLayout({ children }) {
  const data = await getGlobalData()

  const { socialLinks, screensaverImage } = data.result

  return (
    <html lang="en">
      <AppWrapper>
        <body>
          <MainNav
            socialLinks={socialLinks}
          />
          
          <HomeLink />

          <main className='px-14'>{children}</main>

          {screensaverImage && (
            <Screensaver
              image={screensaverImage}
            />
          )}
        </body>
      </AppWrapper>
    </html>
  )
}


/*
----------
GET METADATA
----------
*/

export async function generateMetadata() {
  const res = await fetch(process.env.API_HOST, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${process.env.AUTH}`,
    },
    body: JSON.stringify({
      query: 'site',
      select: {
        title: 'site.title',
        description: 'site.site_description',
        ogImage: 'site.og_image'
      }
    })
  }).then(res => res.json())
 
  const data = res.result

  // const ogImages = data.ogImage ? [data.ogImage] : []

  return {
    title: data.title,
    description: data.description ? data.description : data.title,
    // openGraph: {
    //   images: ogImages
    // }
  }
}
