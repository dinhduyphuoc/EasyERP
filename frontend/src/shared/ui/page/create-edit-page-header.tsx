import type { ReactNode } from 'react'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { Box, Button, CircularProgress, Paper, Stack, Typography, type ButtonProps } from '@mui/material'

export type CreateEditPageHeaderAction = {
  key?: string
  label: string
  loadingLabel?: string
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  variant?: ButtonProps['variant']
  color?: ButtonProps['color']
  startIcon?: ReactNode
}

type BuildHeaderActionInput = Pick<
  CreateEditPageHeaderAction,
  'label' | 'loadingLabel' | 'onClick' | 'disabled' | 'loading'
>

export function buildPrimarySaveHeaderAction(
  input: BuildHeaderActionInput,
): CreateEditPageHeaderAction {
  return {
    ...input,
    variant: 'contained',
    color: 'secondary',
    startIcon: <SaveOutlinedIcon />,
  }
}

export function buildSecondarySaveHeaderAction(
  input: BuildHeaderActionInput,
): CreateEditPageHeaderAction {
  return {
    ...input,
    variant: 'outlined',
    color: 'inherit',
    startIcon: <SaveOutlinedIcon />,
  }
}

type CreateEditPageHeaderProps = {
  title: string
  subtitle?: string
  onBack: () => void
  actions?: CreateEditPageHeaderAction[]
  actionContent?: ReactNode
}

export function CreateEditPageHeader({
  title,
  subtitle,
  onBack,
  actions,
  actionContent,
}: CreateEditPageHeaderProps) {
  const resolvedActionConfigs: CreateEditPageHeaderAction[] | null = actions ?? null

  const resolvedActions = resolvedActionConfigs ? (
    <Stack direction="row" spacing={1.5}>
      {resolvedActionConfigs.map((action, index) => (
        <Button
          key={action.key ?? `${action.label}-${index}`}
          variant={action.variant ?? 'contained'}
          color={action.color ?? 'secondary'}
          startIcon={action.loading ? <CircularProgress size={16} color="inherit" /> : action.startIcon}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.loading ? action.loadingLabel ?? action.label : action.label}
        </Button>
      ))}
    </Stack>
  ) : actionContent

  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{ justifyContent: 'space-between', alignItems: 'center', minWidth: 0 }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', cursor: 'pointer', minWidth: 0, flex: 1 }} onClick={onBack}>
        <Paper
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 1,
          }}
        >
          <ArrowBackIcon sx={{ color: '#344054' }} />
        </Paper>

        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#101828' }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography sx={{ color: '#667085', mt: 0.5 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
      </Stack>

      <Box sx={{ flexShrink: 0 }}>
        {resolvedActions}
      </Box>
    </Stack>
  )
}
