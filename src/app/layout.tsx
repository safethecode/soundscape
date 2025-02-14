import { constructMetadata } from "@/lib/constructMetadata"
import { Pretendard } from "@/styles/fonts"

import Providers from "./providers"

import "@/styles/globals.css"

export const metadata = constructMetadata({
  title: "MagicSpell",
  description: "🦄 Experience rapid development with tailwindcss.",
  domain: "https://example.com",
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={Pretendard.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
