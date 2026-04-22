import type { ReactElement } from 'react'
import { useNavigate } from 'react-router'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import { alpha } from '@mui/material/styles'
import { Box, Paper, Stack, Typography } from '@mui/material'
import { borderedCardSx } from '@/shared/ui/paper'
import { settingsSections } from './settings.config'
import { ListPageHeader } from '@/shared/ui/list/list-page-header'

export function SettingsPage(): ReactElement {
  const navigate = useNavigate()

  return (
    <Stack spacing={4} sx={{ pb: 8 }}>
      <ListPageHeader title="Cài đặt"/>

      {settingsSections.map((section) => (
        <Stack key={section.id} spacing={2}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            {section.items.map((item) => {
              const Icon = item.icon

              return (
                <Paper
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  sx={{
                    ...borderedCardSx,
                    minHeight: 176,
                    cursor: 'pointer',
                    borderRadius: 4,
                    transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 22px 55px rgba(15, 23, 42, 0.12)',
                      borderColor: (theme) => alpha(theme.palette.primary.main, 0.28),
                    },
                  }}
                >
                  <Stack spacing={2.5} sx={{ height: '100%' }}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Box
                        sx={{
                          width: 52,
                          height: 52,
                          borderRadius: 3,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: '#ecfdf3',
                          color: '#067647',
                          flexShrink: 0,
                        }}
                      >
                        <Icon />
                      </Box>
                      <ChevronRightRoundedIcon sx={{ color: '#98a2b3' }} />
                    </Stack>

                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#101828', mb: 1 }}>
                        {item.title}
                      </Typography>
                      <Typography sx={{ color: '#667085', lineHeight: 1.65 }}>
                        {item.description}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              )
            })}
          </Box>
        </Stack>
      ))}
    </Stack>
  )
}
