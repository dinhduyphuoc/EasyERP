import type { ElementType, ReactElement } from 'react'
import { Box, Stack, Typography } from '@mui/material'

type BreadcrumbItem = {
  title: string
  icon?: ElementType
  onClick?: () => void
}

type BreadcrumbProps = {
  parent?: BreadcrumbItem | null
  currentTitle?: string | null
  fallbackTitle?: string
}

export function Breadcrumb({
  parent,
  currentTitle,
  fallbackTitle = 'Settings',
}: BreadcrumbProps): ReactElement {
  if (!parent) {
    return (
      <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#101828' }}>
        {fallbackTitle}
      </Typography>
    )
  }

  const ParentIcon = parent.icon
  const isNested = Boolean(currentTitle)

  return (
    <Stack
      direction="row"
      spacing={1.25}
      sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
    >
      <Stack
        component={isNested ? 'button' : 'div'}
        direction="row"
        spacing={1}
        onClick={isNested ? parent.onClick : undefined}
        type={isNested ? 'button' : undefined}
        sx={{
          alignItems: 'center',
          border: 'none',
          background: 'transparent',
          p: 0,
          color: isNested ? '#667085' : '#101828',
          cursor: isNested ? 'pointer' : 'default',
          fontWeight: isNested ? 600 : 800,
          transition: 'color 160ms ease',
          '&:hover': isNested
            ? {
                color: '#0f766e',
              }
            : undefined,
        }}
      >
        {ParentIcon ? (
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: isNested ? '#f2f4f7' : '#d1fae5',
              color: isNested ? '#667085' : '#047857',
              flexShrink: 0,
            }}
          >
            <ParentIcon fontSize="small" />
          </Box>
        ) : null}
        <Typography
          sx={{
            fontSize: 18,
            fontWeight: isNested ? 600 : 700,
            color: 'inherit',
          }}
        >
          {parent.title}
        </Typography>
      </Stack>

      {isNested ? (
        <>
          <Typography sx={{ color: '#98a2b3', fontWeight: 700 }}>&gt;</Typography>
          <Typography
            sx={{
              fontSize: 18,
              fontWeight: 700,
              color: '#101828',
            }}
          >
            {currentTitle}
          </Typography>
        </>
      ) : null}
    </Stack>
  )
}
