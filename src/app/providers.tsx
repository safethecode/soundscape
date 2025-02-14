"use client"

import { Fragment } from "react"

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <Fragment>
      <link rel="icon" href="/favicon/favicon.ico" />
      <meta
        name="viewport"
        content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no"
      />
      {children}
    </Fragment>
  )
}
