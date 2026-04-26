import { useEffect, useMemo, useState, type ReactElement } from 'react'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
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
  TextField,
  Typography,
} from '@mui/material'
import { useAuth } from '@/modules/auth/use-auth'
import { ListPageHeader } from '@/shared/ui/list/list-page-header'
import { borderedCardSx } from '@/shared/ui/paper'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { adminApi, type PermissionItem, type RoleItem } from './admin.api'

type RoleFormState = {
  slug: string
  name: string
  description: string
  permission_codes: string[]
}

const EMPTY_ROLE_FORM: RoleFormState = {
  slug: '',
  name: '',
  description: '',
  permission_codes: [],
}

export function SettingsRolePermissionPage(): ReactElement {
  const { hasPermission } = useAuth()
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [permissions, setPermissions] = useState<PermissionItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null)
  const [roleForm, setRoleForm] = useState<RoleFormState>(EMPTY_ROLE_FORM)
  const [isSavingRole, setIsSavingRole] = useState(false)
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null)

  const canManageRoles = hasPermission('settings.update')

  useEffect(() => {
    void loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [roleResponse, permissionResponse] = await Promise.all([adminApi.getRoles(), adminApi.getPermissions()])
      setRoles(roleResponse.items)
      setPermissions(permissionResponse.items)
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu phân quyền:', error)
      appToast.error('Không thể tải cấu hình vai trò và quyền.')
    } finally {
      setIsLoading(false)
    }
  }

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, PermissionItem[]>()

    permissions.forEach((permission) => {
      const key = permission.code.split('.')[0] ?? 'other'
      const current = groups.get(key) ?? []
      current.push(permission)
      groups.set(key, current)
    })

    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))
  }, [permissions])

  const resetRoleForm = () => {
    setRoleForm(EMPTY_ROLE_FORM)
    setEditingRole(null)
  }

  const openCreateRoleDialog = () => {
    resetRoleForm()
    setIsRoleDialogOpen(true)
  }

  const openEditRoleDialog = (role: RoleItem) => {
    setEditingRole(role)
    setRoleForm({
      slug: role.slug,
      name: role.name,
      description: role.description ?? '',
      permission_codes: role.permissions.map((permission) => permission.code),
    })
    setIsRoleDialogOpen(true)
  }

  const handleSaveRole = async () => {
    if (!roleForm.name.trim()) {
      appToast.warning('Vui lòng nhập tên vai trò.')
      return
    }

    if (!editingRole && !roleForm.slug.trim()) {
      appToast.warning('Vui lòng nhập mã vai trò.')
      return
    }

    if (roleForm.permission_codes.length === 0) {
      appToast.warning('Vui lòng chọn ít nhất một permission.')
      return
    }

    setIsSavingRole(true)
    try {
      const savedRole = editingRole
        ? await adminApi.updateRole(editingRole.id, {
            name: roleForm.name.trim(),
            description: roleForm.description.trim() || null,
            permission_codes: roleForm.permission_codes,
          })
        : await adminApi.createRole({
            slug: roleForm.slug.trim(),
            name: roleForm.name.trim(),
            description: roleForm.description.trim() || null,
            permission_codes: roleForm.permission_codes,
          })

      setRoles((current) => {
        const existingIndex = current.findIndex((role) => role.id === savedRole.id)
        if (existingIndex === -1) {
          return [...current, savedRole].sort((left, right) => left.name.localeCompare(right.name))
        }

        const next = [...current]
        next[existingIndex] = savedRole
        return next.sort((left, right) => left.name.localeCompare(right.name))
      })

      setIsRoleDialogOpen(false)
      resetRoleForm()
      appToast.success(editingRole ? 'Cập nhật vai trò thành công.' : 'Tạo vai trò thành công.')
    } catch (error) {
      console.error('Lỗi khi lưu vai trò:', error)
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
          : 'Không thể lưu vai trò.'

      appToast.error(message)
    } finally {
      setIsSavingRole(false)
    }
  }

  const handleDeleteRole = async (role: RoleItem) => {
    setDeletingRoleId(role.id)
    try {
      await adminApi.deleteRole(role.id)
      setRoles((current) => current.filter((item) => item.id !== role.id))
      appToast.success('Đã xóa vai trò custom.')
    } catch (error) {
      console.error('Lỗi khi xóa vai trò:', error)
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
          : 'Không thể xóa vai trò.'

      appToast.error(message)
    } finally {
      setDeletingRoleId(null)
    }
  }

  return (
    <Stack spacing={4} sx={{ pb: 8 }}>
      <ListPageHeader
        title="Quản lý phân quyền"
        description="Theo dõi các nhóm vai trò và toàn bộ permission đang được backend RBAC phát hành cho hệ thống."
        actions={
          canManageRoles ? (
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreateRoleDialog}>
              Tạo vai trò
            </Button>
          ) : undefined
        }
      />

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        {[
          { label: 'Vai trò hệ thống', value: roles.length, icon: <AdminPanelSettingsRoundedIcon />, bg: '#eff8ff', color: '#155eef' },
          { label: 'Permission tổng', value: permissions.length, icon: <LockOpenRoundedIcon />, bg: '#ecfdf3', color: '#067647' },
          { label: 'Nhóm permission', value: permissionGroups.length, icon: <TuneRoundedIcon />, bg: '#fdf2fa', color: '#c11574' },
        ].map((item) => (
          <Paper key={item.label} sx={{ ...borderedCardSx, borderRadius: 4 }}>
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
              {item.icon}
            </Box>
            <Typography sx={{ color: '#667085', mb: 1 }}>{item.label}</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#101828' }}>
              {item.value}
            </Typography>
          </Paper>
        ))}
      </Box>

      {isLoading ? (
        <Stack sx={{ py: 8, alignItems: 'center' }}>
          <CircularProgress />
        </Stack>
      ) : (
        <>
          <Paper sx={{ ...borderedCardSx, borderRadius: 4 }}>
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Nhóm vai trò
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  Danh sách role đang tồn tại và toàn bộ permission được gán cho từng nhóm.
                </Typography>
              </Box>

              {roles.length === 0 ? (
                <Alert severity="info">Chưa có vai trò nào được khai báo.</Alert>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
                  }}
                >
                  {roles.map((role) => (
                    <Paper key={role.id} variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
                      <Stack spacing={2}>
                        <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                              <Typography sx={{ fontWeight: 700, color: '#101828' }}>{role.name}</Typography>
                              <Chip
                                size="small"
                                label={role.is_system ? 'System' : 'Custom'}
                                color={role.is_system ? 'default' : 'primary'}
                                variant="outlined"
                              />
                            </Stack>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              `{role.slug}` {role.description ? `- ${role.description}` : ''}
                            </Typography>
                          </Box>
                          {canManageRoles && !role.is_system ? (
                            <Stack direction="row" spacing={1}>
                              <Button size="small" variant="outlined" startIcon={<EditRoundedIcon />} onClick={() => openEditRoleDialog(role)}>
                                Sửa
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                variant="outlined"
                                startIcon={<DeleteOutlineRoundedIcon />}
                                disabled={deletingRoleId === role.id}
                                onClick={() => void handleDeleteRole(role)}
                              >
                                Xóa
                              </Button>
                            </Stack>
                          ) : null}
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                          {role.permissions.map((permission) => (
                            <Chip key={permission.code} label={permission.code} size="small" variant="outlined" />
                          ))}
                        </Stack>
                      </Stack>
                    </Paper>
                  ))}
                </Box>
              )}
            </Stack>
          </Paper>

          <Paper sx={{ ...borderedCardSx, borderRadius: 4 }}>
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Danh mục permission
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  Quyền được nhóm theo prefix để dễ rà soát phạm vi truy cập giữa các module.
                </Typography>
              </Box>

              {permissionGroups.length === 0 ? (
                <Alert severity="info">Chưa có permission nào trong hệ thống.</Alert>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
                  }}
                >
                  {permissionGroups.map(([group, items]) => (
                    <Paper key={group} variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
                      <Typography sx={{ fontWeight: 700, color: '#101828', textTransform: 'capitalize' }}>{group}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                        {items.length} permission
                      </Typography>
                      <Stack spacing={1}>
                        {items.map((permission) => (
                          <Box key={permission.id}>
                            <Typography sx={{ fontWeight: 600, color: '#0f172a' }}>{permission.code}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {permission.description || 'Chưa có mô tả cho permission này.'}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Paper>
                  ))}
                </Box>
              )}
            </Stack>
          </Paper>
        </>
      )}

      <Dialog
        open={isRoleDialogOpen}
        onClose={() => {
          if (!isSavingRole) {
            setIsRoleDialogOpen(false)
            resetRoleForm()
          }
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>{editingRole ? 'Chỉnh sửa vai trò' : 'Tạo vai trò mới'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {!editingRole ? (
              <TextField
                label="Mã vai trò"
                value={roleForm.slug}
                onChange={(event) => setRoleForm((current) => ({ ...current, slug: event.target.value }))}
                helperText="Dùng chữ thường, số và dấu gạch dưới. Ví dụ: branch_manager"
                fullWidth
              />
            ) : null}
            <TextField
              label="Tên vai trò"
              value={roleForm.name}
              onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Mô tả"
              value={roleForm.description}
              onChange={(event) => setRoleForm((current) => ({ ...current, description: event.target.value }))}
              multiline
              minRows={2}
              fullWidth
            />
            <TextField
              select
              label="Permissions"
              slotProps={{ select: { multiple: true } }}
              value={roleForm.permission_codes}
              onChange={(event) =>
                setRoleForm((current) => ({
                  ...current,
                  permission_codes:
                    typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value,
                }))
              }
              helperText="Có thể chọn nhiều permission cho cùng một role."
              fullWidth
            >
              {permissions.map((permission) => (
                <MenuItem key={permission.id} value={permission.code}>
                  {permission.code}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setIsRoleDialogOpen(false)
              resetRoleForm()
            }}
            disabled={isSavingRole}
          >
            Hủy
          </Button>
          <Button onClick={() => void handleSaveRole()} variant="contained" disabled={isSavingRole}>
            {isSavingRole ? 'Đang lưu...' : editingRole ? 'Lưu thay đổi' : 'Tạo vai trò'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
