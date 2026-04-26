import type { ReactElement } from 'react'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import RuleRoundedIcon from '@mui/icons-material/RuleRounded'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import { Box, Paper, Stack, Typography } from '@mui/material'
import { useLocation } from 'react-router'
import { borderedCardSx } from '@/shared/ui/paper'
import { SummaryPaperHeader } from '@/shared/ui/summary-paper-header'
import { settingsItemsByPath } from './settings.config'

export function SettingsPlaceholderPage(): ReactElement {
  const location = useLocation()
  const item = settingsItemsByPath[location.pathname]

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#101828', mb: 1 }}>
          {item?.title ?? 'Settings'}
        </Typography>
        <Typography sx={{ color: '#667085', maxWidth: 760, lineHeight: 1.7 }}>
          {item?.description ?? 'Configure operational preferences for your OMS workspace.'}
        </Typography>
      </Box>

      <Stack spacing={2.5}>
        <Paper sx={borderedCardSx}>
          <Stack spacing={2}>
            <SummaryPaperHeader title="Configuration overview" />
            <Typography sx={{ color: '#667085', lineHeight: 1.7 }}>
              This section is part of the new settings workspace. The navigation, permissions, and
              page framing are ready, and this module can now be expanded with production forms.
            </Typography>
          </Stack>
        </Paper>

        <Paper sx={borderedCardSx}>
          <Stack spacing={2}>
            <SummaryPaperHeader title="Suggested fields" />
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
              <TuneRoundedIcon sx={{ color: '#0f766e' }} />
              <Typography sx={{ color: '#344054' }}>Default preferences and operational toggles</Typography>
            </Stack>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
              <RuleRoundedIcon sx={{ color: '#0f766e' }} />
              <Typography sx={{ color: '#344054' }}>Validation rules, workflow logic, and safeguards</Typography>
            </Stack>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
              <InsightsRoundedIcon sx={{ color: '#0f766e' }} />
              <Typography sx={{ color: '#344054' }}>Reporting metadata and sync behavior</Typography>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Stack>
  )
}
