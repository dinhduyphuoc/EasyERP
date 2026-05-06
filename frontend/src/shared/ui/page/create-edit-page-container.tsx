import type { PropsWithChildren, ReactElement } from 'react'
import { Box, type BoxProps } from '@mui/material'

type CreateEditPageContainerProps = PropsWithChildren<{
  sx?: BoxProps['sx']
}>

function SharedPageContainer({
  children,
  sx,
}: CreateEditPageContainerProps): ReactElement {
  return (
    <Box
      sx={[
        {
          px: { xs: 2, md: 3, xl: 4 },
          pb: 8,
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Box>
  )
}

export function CreateEditPageContainer(props: CreateEditPageContainerProps): ReactElement {
  return <SharedPageContainer {...props} />
}

export function PageContentContainer(props: CreateEditPageContainerProps): ReactElement {
  return <SharedPageContainer {...props} />
}
