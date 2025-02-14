import { Metadata } from "next"

interface SEOMetadata {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  icons?: string;
  domain: string;
}

export function constructMetadata({
  title,
  description,
  keywords,
  image,
  icons,
  domain,
}: SEOMetadata): Metadata {
  return {
    title,
    description,
    keywords,
    icons,
    openGraph: {
      title,
      description,
      images: [
        {
          url: image as string,
        },
      ],
    },
    metadataBase: new URL(domain),
  }
}
