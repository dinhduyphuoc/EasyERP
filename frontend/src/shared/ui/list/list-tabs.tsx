import { Box, Chip, Tab, Tabs } from '@mui/material'
import type { ListTabConfig } from '@/shared/ui/list/common-list.types'

type ListTabsProps = {
  tabs: ListTabConfig[]
  activeTab: string
  onTabChange: (value: string) => void
}

export function ListTabs({ tabs, activeTab, onTabChange }: ListTabsProps) {
  return (
    <Box sx={{ borderBottom: (theme) => `1px solid ${theme.palette.divider}` }}>
      <Tabs
        value={activeTab}
        onChange={(_, value) => onTabChange(value)}
        variant="scrollable"
        scrollButtons="auto"
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
            label={
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                {tab.label}
                {typeof tab.count === 'number' ? (
                  <Chip size="small" label={tab.count} color={activeTab === tab.value ? 'primary' : 'default'} />
                ) : null}
              </Box>
            }
          />
        ))}
      </Tabs>
    </Box>
  )
}

