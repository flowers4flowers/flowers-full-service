// next/queries/shopQuery.js
import { kirbyFetch } from "@/queries/kirbyFetch";

export async function getShopData() {
  return kirbyFetch({
    query: `site.find('shop')`,
    select: {
      text: {
        query: "page.text.kirbyText",
      },
    },
  });
}
