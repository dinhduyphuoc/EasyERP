import { useId, useState, type ReactElement } from 'react'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import {
  Avatar,
  Box,
  ButtonBase,
  CircularProgress,
  Divider,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Typography,
  alpha,
} from '@mui/material'

export type StoreSwitcherStore = {
  id: string
  name: string
  slug: string
  avatarUrl?: string | null
}

export type StoreSwitcherUser = {
  id: string
  fullName: string
  email: string
  avatarUrl?: string | null
}

type StoreSwitcherDropdownProps = {
  stores: StoreSwitcherStore[]
  activeStoreId: string
  user: StoreSwitcherUser
  onSwitchStore: (storeId: string) => Promise<void> | void
  onCreateStore: () => void
  onLogout: () => Promise<void> | void
}

const getInitials = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'S'

function StoreAvatar({
  name,
  avatarUrl,
}: {
  name: string
  avatarUrl?: string | null
}): ReactElement {
  return (
    <Avatar
      src={avatarUrl ?? undefined}
      variant="rounded"
      sx={{
        width: 34,
        height: 34,
        bgcolor: '#0f766e',
        color: 'common.white',
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      {!avatarUrl ? getInitials(name) : null}
    </Avatar>
  )
}

export function StoreRow({
  store,
  isActive,
  isLoading,
  onSelect,
}: {
  store: StoreSwitcherStore
  isActive: boolean
  isLoading: boolean
  onSelect: () => void
}): ReactElement {
  return (
    <MenuItem
      onClick={onSelect}
      disabled={isLoading}
      sx={{
        px: 1.5,
        py: 1,
        borderRadius: 2.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        '&:hover': {
          bgcolor: alpha('#0f766e', 0.06),
        },
      }}
    >
      <StoreAvatar name={store.name} avatarUrl={store.avatarUrl} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontWeight: 700, color: '#101828' }} noWrap>
          {store.name}
        </Typography>
        <Typography variant="body2" sx={{ color: '#667085' }} noWrap>
          {store.slug}
        </Typography>
      </Box>
      {isLoading ? (
        <CircularProgress size={16} sx={{ color: '#0f766e' }} />
      ) : isActive ? (
        <CheckRoundedIcon sx={{ color: '#0f766e' }} fontSize="small" />
      ) : null}
    </MenuItem>
  )
}

export function AccountInfo({ user }: { user: StoreSwitcherUser }): ReactElement {
  return (
    <Stack direction="row" spacing={1.25} sx={{ px: 2, py: 1.5, alignItems: 'center' }}>
      <Avatar src={user.avatarUrl ?? undefined} sx={{ bgcolor: '#155eef', width: 40, height: 40 }}>
        {!user.avatarUrl ? getInitials(user.fullName) : null}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, color: '#101828' }} noWrap>
          {user.fullName}
        </Typography>
        <Typography variant="body2" sx={{ color: '#667085' }} noWrap>
          {user.email}
        </Typography>
      </Box>
    </Stack>
  )
}

export function StoreSwitcherDropdown({
  stores,
  activeStoreId,
  user,
  onSwitchStore,
  onCreateStore,
  onLogout,
}: StoreSwitcherDropdownProps): ReactElement {
  const menuId = useId()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [switchingStoreId, setSwitchingStoreId] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const isOpen = Boolean(anchorEl)
  const activeStore = stores.find((store) => store.id === activeStoreId) ?? stores[0] ?? null

  const handleClose = () => setAnchorEl(null)

  const handleSwitchStore = async (storeId: string) => {
    if (storeId === activeStoreId || switchingStoreId) {
      handleClose()
      return
    }

    setSwitchingStoreId(storeId)

    try {
      await onSwitchStore(storeId)
      handleClose()
    } finally {
      setSwitchingStoreId(null)
    }
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)

    try {
      await onLogout()
      handleClose()
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <>
      <ButtonBase
        aria-controls={isOpen ? menuId : undefined}
        aria-expanded={isOpen ? 'true' : undefined}
        aria-haspopup="menu"
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{
          px: 1.5,
          py: 1,
          borderRadius: 3,
          border: '1px solid rgba(15, 23, 42, 0.08)',
          bgcolor: 'common.white',
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          minWidth: { sm: 240 },
          justifyContent: 'space-between',
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Avatar
            src={user.avatarUrl ?? undefined}
            sx={{
              width: 34,
              height: 34,
              bgcolor: '#155eef',
              color: 'common.white',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {!user.avatarUrl ? getInitials(user.fullName) : null}
          </Avatar>
          <Box sx={{ textAlign: 'left', minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, color: '#0f172a' }} noWrap>
              {user.fullName}
            </Typography>
            <Typography variant="body2" sx={{ color: '#667085' }} noWrap>
              {activeStore?.name ?? (stores.length > 0 ? `${stores.length} store${stores.length > 1 ? 's' : ''}` : 'No store yet')}
            </Typography>
          </Box>
        </Stack>
        <ExpandMoreRoundedIcon
          sx={{
            color: '#667085',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 180ms ease',
          }}
        />
      </ButtonBase>

      <Menu
        id={menuId}
        anchorEl={anchorEl}
        open={isOpen}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              minWidth: 340,
              maxWidth: 'calc(100vw - 24px)',
              borderRadius: 4,
              border: '1px solid rgba(15, 23, 42, 0.08)',
              bgcolor: 'common.white',
              boxShadow: '0 22px 55px rgba(15, 23, 42, 0.14)',
              overflow: 'hidden',
            },
          },
          list: {
            sx: {
              p: 1.25,
            },
          },
        }}
      >
        <Box sx={{ px: 1, pb: 1 }}>
          <Typography variant="subtitle2" sx={{ px: 1, py: 0.5, color: '#475467' }}>
            Stores
          </Typography>
          <Stack spacing={0.5}>
            {stores.length > 0 ? (
              stores.map((store) => (
                <StoreRow
                  key={store.id}
                  store={store}
                  isActive={store.id === activeStoreId}
                  isLoading={switchingStoreId === store.id}
                  onSelect={() => void handleSwitchStore(store.id)}
                />
              ))
            ) : (
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography sx={{ color: '#667085' }}>No store yet. Create one to continue.</Typography>
              </Box>
            )}
          </Stack>
        </Box>

        <Divider />

        <MenuItem
          onClick={() => {
            handleClose()
            onCreateStore()
          }}
          sx={{ px: 2, py: 1.5, gap: 1.25 }}
        >
          <ListItemIcon sx={{ minWidth: 0 }}>
            <AddRoundedIcon fontSize="small" />
          </ListItemIcon>
          <Typography sx={{ fontWeight: 600 }}>Tạo cửa hàng</Typography>
        </MenuItem>

        <Divider />

        <AccountInfo user={user} />

        <Divider />

        <MenuItem
          onClick={() => void handleLogout()}
          disabled={isLoggingOut}
          sx={{ px: 2, py: 1.5, gap: 1.25 }}
        >
          <ListItemIcon sx={{ minWidth: 0 }}>
            {isLoggingOut ? (
              <CircularProgress size={16} />
            ) : (
              <LogoutRoundedIcon fontSize="small" />
            )}
          </ListItemIcon>
          <Typography sx={{ fontWeight: 600 }}>Log out</Typography>
        </MenuItem>
      </Menu>
    </>
  )
}
