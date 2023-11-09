import { getShopData } from "@/queries/shopQuery"

export default async function Shop() {
  const data = await getShopData()

  const { text } = data.result

  if (text) {
    return (
      <div
        className="flex justify-center items-center h-full"
      >
        <div
          className="text-md lg:text-lg font-secondary w-full lg:w-1/2 text-center"
          dangerouslySetInnerHTML={{ __html: text }}
        ></div>
      </div>
    )
  }

  return
}
