import { useEffect, useMemo, useState, type ReactElement } from 'react'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded'
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useAuth } from '@/modules/auth/use-auth'
import { ListPageHeader } from '@/shared/ui/list/list-page-header'
import { borderedCardSx } from '@/shared/ui/paper'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { adminApi, type AdminUserItem, type RoleItem } from './admin.api'

type UserStatus = 'active' | 'inactive' | 'blocked'

const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Đang hoạt động',
  inactive: 'Ngưng hoạt động',
  blocked: 'Đã khóa',
}

const STATUS_COLORS: Record<UserStatus, 'success' | 'warning' | 'error'> = {
  active: 'success',
  inactive: 'warning',
  blocked: 'error',
}

type UserFormState = {
  full_name: string
  email: string
  password: string
  role_slugs: string[]
}

const EMPTY_CREATE_FORM: UserFormState = {
  full_name: '',
  email: '',
  password: '',
  role_slugs: [],
}

export function SettingsAccountsPage(): ReactElement {
  const { hasPermission } = useAuth()
  const [users, setUsers] = useState<AdminUserItem[]>([])
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<UserFormState>(EMPTY_CREATE_FORM)
  const [isCreating, setIsCreating] = useState(false)
  const [roleEditorUser, setRoleEditorUser] = useState<AdminUserItem | null>(null)
  const [selectedRoleSlugs, setSelectedRoleSlugs] = useState<string[]>([])
  const [isSavingRoles, setIsSavingRoles] = useState(false)
  const [savingStatusByUserId, setSavingStatusByUserId] = useState<Record<string, boolean>>({})

  const canCreateUser = hasPermission('users.create')
  const canAssignRole = hasPermission('users.assign_role')
  const canUpdateStatus = hasPermission('users.disable')

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [userResponse, roleResponse] = await Promise.all([adminApi.getUsers(), adminApi.getRoles()])
      setUsers(userResponse.items)
      setRoles(roleResponse.items)
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu tài khoản:', error)
      appToast.error('Không thể tải danh sách tài khoản hoặc vai trò.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const userSummary = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((user) => user.status === 'active').length,
      blocked: users.filter((user) => user.status === 'blocked').length,
      inactive: users.filter((user) => user.status === 'inactive').length,
    }
  }, [users])

  const resetCreateForm = () => {
    setCreateForm(EMPTY_CREATE_FORM)
  }

  const handleCreateUser = async () => {
    if (!createForm.full_name.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      appToast.warning('Vui lòng nhập đầy đủ họ tên, email và mật khẩu.')
      return
    }

    if (createForm.role_slugs.length === 0) {
      appToast.warning('Vui lòng chọn ít nhất một vai trò.')
      return
    }

    setIsCreating(true)
    try {
      const createdUser = await adminApi.createUser({
        full_name: createForm.full_name.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        role_slugs: createForm.role_slugs,
      })

      setUsers((current) => [createdUser, ...current])
      setIsCreateOpen(false)
      resetCreateForm()
      appToast.success('Tạo tài khoản thành công.')
    } catch (error) {
      console.error('Lỗi khi tạo tài khoản:', error)
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof error.response === 'object' &&
        error.response !== null &&
        'data' in error.response &&
        typeof error.response.data === 'object' &&
        error.response.data !== null &&
        'message' in error.response.data &&
        typeof error.response.data.message === 'string'
          ? error.response.data.message
          : 'Không thể tạo tài khoản.'

      appToast.error(message)
    } finally {
      setIsCreating(false)
    }
  }

  const openRoleEditor = (user: AdminUserItem) => {
    setRoleEditorUser(user)
    setSelectedRoleSlugs(user.roles.map((role) => role.slug))
  }

  const handleSaveRoles = async () => {
    if (!roleEditorUser) {
      return
    }

    if (selectedRoleSlugs.length === 0) {
      appToast.warning('Vui lòng giữ lại ít nhất một vai trò cho tài khoản.')
      return
    }

    setIsSavingRoles(true)
    try {
      const updatedUser = await adminApi.assignRoles(roleEditorUser.id, selectedRoleSlugs)
      setUsers((current) => current.map((user) => (user.id === updatedUser.id ? updatedUser : user)))
      setRoleEditorUser(null)
      setSelectedRoleSlugs([])
      appToast.success('Cập nhật vai trò thành công.')
    } catch (error) {
      console.error('Lỗi khi cập nhật vai trò:', error)
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof error.response === 'object' &&
        error.response !== null &&
        'data' in error.response &&
        typeof error.response.data === 'object' &&
        error.response.data !== null &&
        'message' in error.response.data &&
        typeof error.response.data.message === 'string'
          ? error.response.data.message
          : 'Không thể cập nhật vai trò.'

      appToast.error(message)
    } finally {
      setIsSavingRoles(false)
    }
  }

  const handleStatusChange = async (userId: string, status: UserStatus) => {
    setSavingStatusByUserId((current) => ({ ...current, [userId]: true }))

    try {
      const updatedUser = await adminApi.updateStatus(userId, status)
      setUsers((current) => current.map((user) => (user.id === updatedUser.id ? updatedUser : user)))
      appToast.success('Đã cập nhật trạng thái tài khoản.')
    } catch (error) {
      console.error('Lỗi khi cập nhật trạng thái tài khoản:', error)
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof error.response === 'object' &&
        error.response !== null &&
        'data' in error.response &&
        typeof error.response.data === 'object' &&
        error.response.data !== null &&
        'message' in error.response.data &&
        typeof error.response.data.message === 'string'
          ? error.response.data.message
          : 'Không thể cập nhật trạng thái tài khoản.'

      appToast.error(message)
    } finally {
      setSavingStatusByUserId((current) => ({ ...current, [userId]: false }))
    }
  }

  return (
    <Stack spacing={4} sx={{ pb: 8 }}>
      <ListPageHeader
        title="Quản lý tài khoản"
        description="Tạo tài khoản vận hành, gán vai trò và cập nhật trạng thái sử dụng cho từng nhân sự."
        actions={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button variant="outlined" startIcon={<AutorenewRoundedIcon />} onClick={() => void loadData()} disabled={isLoading}>
              Làm mới
            </Button>
            {canCreateUser ? (
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setIsCreateOpen(true)}>
                Tạo tài khoản
              </Button>
            ) : null}
          </Stack>
        }
      />

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
        }}
      >
        {[
          { label: 'Tổng tài khoản', value: userSummary.total, color: '#155eef', bg: '#eff8ff' },
          { label: 'Đang hoạt động', value: userSummary.active, color: '#067647', bg: '#ecfdf3' },
          { label: 'Ngưng hoạt động', value: userSummary.inactive, color: '#b54708', bg: '#fff7ed' },
          { label: 'Đã khóa', value: userSummary.blocked, color: '#b42318', bg: '#fef3f2' },
        ].map((item) => (
          <Paper key={item.label} sx={{ ...borderedCardSx, borderRadius: 4 }}>
            <Typography sx={{ color: '#667085', mb: 1 }}>{item.label}</Typography>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 3,
                display: 'grid',
                placeItems: 'center',
                bgcolor: item.bg,
                color: item.color,
                mb: 1.5,
              }}
            >
              <ManageAccountsRoundedIcon />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#101828' }}>
              {item.value}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Paper sx={{ ...borderedCardSx, borderRadius: 4, overflow: 'hidden' }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Danh sách tài khoản
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              Xem nhanh email đăng nhập, vai trò hiện có, trạng thái và lần truy cập gần nhất.
            </Typography>
          </Box>

          {isLoading ? (
            <Stack sx={{ py: 6, alignItems: 'center' }}>
              <CircularProgress />
            </Stack>
          ) : users.length === 0 ? (
            <Alert severity="info">Chưa có tài khoản nào được tạo.</Alert>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Họ tên</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Vai trò</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell>Lần đăng nhập gần nhất</TableCell>
                  <TableCell align="right">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => {
                  const isSavingStatus = Boolean(savingStatusByUserId[user.id])

                  return (
                    <TableRow key={user.id} hover>
                      <TableCell>
                        <Typography sx={{ fontWeight: 700, color: '#101828' }}>{user.full_name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {user.scopes.length > 0
                            ? user.scopes.map((scope) => `${scope.scope_type}: ${scope.scope_value}`).join(' | ')
                            : 'Chưa có scope riêng'}
                        </Typography>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                          {user.roles.map((role) => (
                            <Chip key={role.slug} label={role.name} size="small" variant="outlined" />
                          ))}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={STATUS_LABELS[user.status]}
                          color={STATUS_COLORS[user.status]}
                          size="small"
                          variant={user.status === 'active' ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell>{user.last_login_at ? new Date(user.last_login_at).toLocaleString('vi-VN') : 'Chưa đăng nhập'}</TableCell>
                      <TableCell align="right">
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ justifyContent: 'flex-end' }}>
                          {canAssignRole ? (
                            <Button size="small" variant="outlined" onClick={() => openRoleEditor(user)}>
                              Phân quyền
                            </Button>
                          ) : null}
                          {canUpdateStatus ? (
                            <TextField
                              select
                              size="small"
                              value={user.status}
                              disabled={isSavingStatus}
                              onChange={(event) => void handleStatusChange(user.id, event.target.value as UserStatus)}
                              sx={{ minWidth: 160 }}
                            >
                              <MenuItem value="active">Đang hoạt động</MenuItem>
                              <MenuItem value="inactive">Ngưng hoạt động</MenuItem>
                              <MenuItem value="blocked">Khóa tài khoản</MenuItem>
                            </TextField>
                          ) : null}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </Stack>
      </Paper>

      <Dialog open={isCreateOpen} onClose={() => !isCreating && setIsCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Tạo tài khoản</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Họ tên"
              value={createForm.full_name}
              onChange={(event) => setCreateForm((current) => ({ ...current, full_name: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              value={createForm.email}
              onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Mật khẩu tạm"
              type="password"
              value={createForm.password}
              onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
              fullWidth
            />
            <TextField
              select
              label="Vai trò"
              slotProps={{ select: { multiple: true } }}
              value={createForm.role_slugs}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  role_slugs: typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value,
                }))
              }
              helperText="Có thể chọn nhiều vai trò cho cùng một tài khoản."
              fullWidth
            >
              {roles.map((role) => (
                <MenuItem key={role.slug} value={role.slug}>
                  {role.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setIsCreateOpen(false)
              resetCreateForm()
            }}
            disabled={isCreating}
          >
            Hủy
          </Button>
          <Button onClick={() => void handleCreateUser()} variant="contained" disabled={isCreating}>
            {isCreating ? 'Đang tạo...' : 'Tạo tài khoản'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(roleEditorUser)} onClose={() => !isSavingRoles && setRoleEditorUser(null)} fullWidth maxWidth="sm">
        <DialogTitle>Phân quyền tài khoản</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography color="text.secondary">
              {roleEditorUser ? `Cập nhật vai trò cho ${roleEditorUser.full_name}` : ''}
            </Typography>
            <TextField
              select
              label="Vai trò"
              slotProps={{ select: { multiple: true } }}
              value={selectedRoleSlugs}
              onChange={(event) =>
                setSelectedRoleSlugs(
                  typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value,
                )
              }
              helperText="Hệ thống hiện dùng danh sách role toàn cục từ RBAC."
              fullWidth
            >
              {roles.map((role) => (
                <MenuItem key={role.slug} value={role.slug}>
                  {role.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleEditorUser(null)} disabled={isSavingRoles}>
            Hủy
          </Button>
          <Button onClick={() => void handleSaveRoles()} variant="contained" disabled={isSavingRoles}>
            {isSavingRoles ? 'Đang lưu...' : 'Lưu phân quyền'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
