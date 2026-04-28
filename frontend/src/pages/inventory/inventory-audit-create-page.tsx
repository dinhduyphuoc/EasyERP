import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { useNavigate, useParams } from 'react-router'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  IconButton,
  LinearProgress,
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
import { inventoryApi, type InventoryAuditItem, type InventoryAuditPayload, type InventoryStockListItem } from './inventory.api'
import { defaultCardSx } from '@/shared/ui/paper'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { formatCurrency as sharedFormatCurrency } from '@/shared/utils/currency'
import { InventoryAuditPageSkeleton } from './inventory-skeletons'

type AuditLineDraft = {
  product_variant_id: string
  actualQty: string
}

type InventorySearchOption =
  | {
      type: 'product'
      product_id: number
      product_name: string
      unit: string | null
      variantCount: number
      variantIds: string[]
    }
  | {
      type: 'variant'
      item: InventoryStockListItem
    }

function parseQty(value: string) {
  if (!value.trim()) {
    return null
  }

  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : undefined
}

function sanitizeActualQtyInput(value: string) {
  if (value === '') {
    return ''
  }

  const isNegative = value.trimStart().startsWith('-')
  const digits = value.replace(/[^\d]/g, '')

  if (!digits) {
    return isNegative ? '-' : ''
  }

  return `${isNegative ? '-' : ''}${digits}`
}

function formatCurrency(value: number) {
  return sharedFormatCurrency(value)
  return `${value.toLocaleString('vi-VN')} đ`
}

function getAuditCode() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const stamp = `${yyyy}${mm}${dd}`
  return `AUD-${stamp}`
}

function getStatusLabel(audit: InventoryAuditItem | null, isEditMode: boolean) {
  if (!isEditMode) {
    return 'Phiếu mới'
  }

  if (audit?.status === 'draft') {
    return 'Chỉnh sửa'
  }

  if (audit?.status === 'completed') {
    return 'Hoàn thành'
  }

  return 'Chỉnh sửa'
}

export function InventoryAuditCreatePage(): ReactElement {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = Boolean(id)
  const [audit, setAudit] = useState<InventoryAuditItem | null>(null)
  const [rows, setRows] = useState<InventoryStockListItem[]>([])
  const [lines, setLines] = useState<Record<string, AuditLineDraft>>({})
  const [auditCode, setAuditCode] = useState(getAuditCode())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<InventoryStockListItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const isCompletedAudit = audit?.status === 'completed'

  useEffect(() => {
    const fetchPageData = async () => {
      setIsLoading(true)

      try {
        if (isEditMode && id) {
          const auditDetail = await inventoryApi.getAuditById(id)
          setAudit(auditDetail)
          setAuditCode(auditDetail.audit_code)
          setRows(
            auditDetail.lines.map((line) => ({
              product_variant_id: line.product_variant_id,
              product_id: line.product_id ?? 0,
              product_name: line.product_name ?? '',
              product_status: line.product_status,
              display_name: line.display_name,
              sku: line.sku,
              unit: line.unit,
              image_url: line.image_url,
              on_hand: line.system_on_hand,
              available: line.system_on_hand,
              committed: 0,
              packing: 0,
              incoming: 0,
              selling_price: line.selling_price ?? '0',
              cogs: line.cogs ?? '0',
              is_variant: true,
            })),
          )
          setLines(
            Object.fromEntries(
              auditDetail.lines.map((line) => [
                line.product_variant_id,
                {
                  product_variant_id: line.product_variant_id,
                  actualQty: line.counted_on_hand === null ? '' : String(line.counted_on_hand),
                },
              ]),
            ),
          )
          return
        }
      } catch (error) {
        console.error('Lỗi khi tải dữ liệu phiếu kiểm kho:', error)
        appToast.error('Không thể tải dữ liệu phiếu kiểm kho.')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchPageData()
  }, [id, isEditMode])

  useEffect(() => {
    if (isEditMode === false && searchKeyword.trim().length === 0) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    if (searchKeyword.trim().length > 0) {
      setIsSearching(true)
    }

    const timer = window.setTimeout(async () => {
      if (searchKeyword.trim().length === 0) {
        setSearchResults([])
        setIsSearching(false)
        return
      }

      try {
        const data = await inventoryApi.getStockList({
          search: searchKeyword.trim(),
        })

        setSearchResults(
          data.filter(
            (item) =>
              item.product_status !== 'deleted' &&
              !rows.some((selectedRow) => selectedRow.product_variant_id === item.product_variant_id),
          ),
        )
      } catch (error) {
        console.error('Lỗi khi tìm sản phẩm kiểm kho:', error)
      } finally {
        setIsSearching(false)
      }
    }, 250)

    return () => window.clearTimeout(timer)
  }, [isEditMode, rows, searchKeyword])

  const autocompleteOptions = useMemo<InventorySearchOption[]>(() => {
    if (searchKeyword.trim().length === 0) {
      return []
    }

    const productGroups = new Map<
      number,
      { product_name: string; unit: string | null; variantIds: string[] }
    >()

    for (const item of searchResults) {
      const existingGroup = productGroups.get(item.product_id)

      if (existingGroup) {
        existingGroup.variantIds.push(item.product_variant_id)
        continue
      }

      productGroups.set(item.product_id, {
        product_name: item.product_name,
        unit: item.unit,
        variantIds: [item.product_variant_id],
      })
    }

    const productOptions: InventorySearchOption[] = [...productGroups.entries()]
      .filter(([, group]) => group.variantIds.length > 1)
      .map(([productId, group]) => ({
        type: 'product',
        product_id: productId,
        product_name: group.product_name,
        unit: group.unit,
        variantCount: group.variantIds.length,
        variantIds: group.variantIds,
      }))

    const variantOptions: InventorySearchOption[] = searchResults.map((item) => ({
      type: 'variant',
      item,
    }))

    return [...productOptions, ...variantOptions]
  }, [searchKeyword, searchResults])

  const tableRows = useMemo(
    () =>
      rows.map((row) => {
        const actualQty = parseQty(lines[row.product_variant_id]?.actualQty ?? '')
        const safeActualQty = actualQty ?? row.on_hand
        const differenceQty = safeActualQty - row.on_hand
        const varianceValue = Number(row.cogs) * differenceQty

        return {
          ...row,
          actualQty: lines[row.product_variant_id]?.actualQty ?? '',
          differenceQty,
          varianceValue,
          hasInvalidActualQty: actualQty === undefined,
          isActualQtyBlank: actualQty === null,
        }
      }),
    [lines, rows],
  )

  const hasInvalidQty = tableRows.some((row) => row.hasInvalidActualQty)
  const hasBlankQty = tableRows.some((row) => row.isActualQtyBlank)

  const handleActualQtyChange = (productVariantId: string, value: string) => {
    setLines((current) => ({
      ...current,
      [productVariantId]: {
        product_variant_id: productVariantId,
        actualQty: sanitizeActualQtyInput(value),
      },
    }))
  }

  const handleRemoveRow = (productVariantId: string) => {
    setRows((current) => current.filter((row) => row.product_variant_id !== productVariantId))
    setLines((current) => {
      const newLines = { ...current }
      delete newLines[productVariantId]
      return newLines
    })
  }

  const handleAddProduct = (option: InventorySearchOption | null) => {
    if (!option) {
      return
    }

    if (option.type === 'product') {
      const variantsToAdd = searchResults.filter((item) =>
        option.variantIds.includes(item.product_variant_id),
      )

      setRows((current) => {
        const selectedVariantIds = new Set(current.map((row) => row.product_variant_id))
        const nextVariants = variantsToAdd.filter(
          (item) => !selectedVariantIds.has(item.product_variant_id),
        )

        return nextVariants.length > 0 ? [...current, ...nextVariants] : current
      })

      setLines((current) => {
        const next = { ...current }

        for (const item of variantsToAdd) {
          next[item.product_variant_id] = next[item.product_variant_id] ?? {
            product_variant_id: item.product_variant_id,
            actualQty: '',
          }
        }

        return next
      })

      setSearchKeyword('')
      setSearchResults([])
      return
    }

    const item = option.item

    setRows((current) => {
      if (current.some((row) => row.product_variant_id === item.product_variant_id)) {
        return current
      }

      return [...current, item]
    })

    setLines((current) => ({
      ...current,
      [item.product_variant_id]: current[item.product_variant_id] ?? {
        product_variant_id: item.product_variant_id,
        actualQty: '',
      },
    }))

    setSearchKeyword('')
    setSearchResults([])
  }

  const handleSave = async (mode: 'draft' | 'complete') => {
    if (hasInvalidQty) {
      appToast.error('Có dòng thực tế không hợp lệ. Vui lòng kiểm tra lại.')
      return
    }

    if (mode === 'complete' && tableRows.length === 0) {
      appToast.error('Vui lòng chọn ít nhất một sản phẩm để kiểm kho.')
      return
    }

    if (mode === 'complete' && hasBlankQty) {
      appToast.error('Vui lòng nhập số thực tế cho tất cả sản phẩm trước khi hoàn thành phiếu.')
      return
    }

    setIsSaving(true)

    try {
      const payload: InventoryAuditPayload = {
        audit_code: isEditMode ? auditCode : undefined,
        status: 'draft',
        lines: tableRows.map((row) => ({
          product_variant_id: row.product_variant_id,
          counted_on_hand: parseQty(row.actualQty) ?? null,
        })),
      }

      const savedAudit =
        isEditMode && id
          ? await inventoryApi.updateAudit(id, payload)
          : await inventoryApi.createAudit(payload)

      const finalAudit =
        mode === 'complete'
          ? await inventoryApi.completeAudit(savedAudit.id)
          : savedAudit

      setAudit(finalAudit)
      setAuditCode(finalAudit.audit_code)

      appToast.success(
        mode === 'draft'
          ? isEditMode
            ? 'Cập nhật phiếu kiểm hàng thành công.'
            : 'Đã lưu nháp phiếu kiểm hàng.'
          : isEditMode
            ? 'Cập nhật phiếu kiểm hàng thành công.'
            : 'Cập nhật phiếu kiểm hàng thành công.',
      )

      navigate('/inventory/audit')
    } catch (error) {
      console.error('Lỗi khi lưu phiếu kiểm kho:', error)
      appToast.error('Không thể lưu phiếu kiểm kho.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <InventoryAuditPageSkeleton />
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <IconButton
          onClick={() => navigate('/inventory/audit')}
          sx={{
            border: '1px solid #d0d5dd',
            borderRadius: '4px',
            color: '#344054',
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: '#101828' }}>
          {isEditMode ? 'Chỉnh sửa phiếu kiểm kho' : 'Tạo phiếu kiểm kho'}
        </Typography>
      </Stack>

      <Paper sx={defaultCardSx}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} sx={{ justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" sx={{ color: '#667085', mb: 0.75 }}>
              Mã kiểm kho
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#101828' }}>
              {auditCode}
            </Typography>
          </Box>

          <Box>
            <Typography variant="body2" sx={{ color: '#667085', mb: 0.75 }}>
              Trạng thái
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#101828' }}>
              {getStatusLabel(audit, isEditMode)}
            </Typography>
          </Box>

          {isCompletedAudit ? null : <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />}
              disabled={isLoading || isSaving}
              onClick={() => void handleSave('draft')}
            >
              Lưu nháp
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <TaskAltOutlinedIcon />}
              disabled={isLoading || isSaving}
              onClick={() => void handleSave('complete')}
            >
              Lưu
            </Button>
          </Stack>}
        </Stack>
      </Paper>

      <Paper sx={defaultCardSx}>
        <Stack spacing={2}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#101828' }}>
            Bảng kiểm kho
          </Typography>

          {isCompletedAudit ? null : <Autocomplete
            options={autocompleteOptions}
            filterOptions={(options) => options}
            loading={isSearching}
            open={searchKeyword.trim().length > 0}
            value={null}
            onChange={(_, value) => handleAddProduct(value)}
            getOptionLabel={(option) =>
              option.type === 'product'
                ? option.product_name
                : `${option.item.sku} - ${option.item.display_name}`
            }
            inputValue={searchKeyword}
            onInputChange={(_, value) => setSearchKeyword(value)}
            loadingText="Đang tìm sản phẩm..."
            noOptionsText={
              searchKeyword.trim()
                ? isSearching
                  ? 'Đang tìm kiếm...'
                  : 'Không tìm thấy sản phẩm'
                : 'Nhập SKU hoặc tên sản phẩm'
            }
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Stack spacing={0.5} sx={{ py: 0.5 }}>
                  {option.type === 'product' ? (
                    <>
                      <Typography sx={{ fontWeight: 700, color: '#101828' }}>
                        {option.product_name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {option.variantCount} phiên bản
                      </Typography>
                    </>
                  ) : (
                    <>
                      <Typography sx={{ fontWeight: 700, color: '#101828' }}>
                        {option.item.sku}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {option.item.display_name}
                      </Typography>
                    </>
                  )}
                </Stack>
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Tìm sản phẩm theo tên, SKU..."
                placeholder="Tìm sản phẩm theo tên, SKU..."
              />
            )}
          />}

          {!isCompletedAudit && isSearching ? <LinearProgress sx={{ borderRadius: '999px' }} /> : null}

          {isLoading ? (
            <Alert severity="info">Đang tải dữ liệu tồn kho...</Alert>
          ) : tableRows.length === 0 ? (
            <Alert severity="warning">
              Chưa có sản phẩm nào trong bảng kiểm kho. Hãy tìm kiếm và chọn sản phẩm để thêm vào phiếu.
            </Alert>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    <TableCell>SKU</TableCell>
                    <TableCell>Tên sản phẩm</TableCell>
                    <TableCell>Đơn vị tính</TableCell>
                    <TableCell align="right">Tồn kho</TableCell>
                    <TableCell align="right">Thực tế</TableCell>
                    <TableCell align="right">Chênh lệch</TableCell>
                    <TableCell align="right">Giá trị lệch</TableCell>
                    <TableCell align="right" sx={{ width: 48 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableRows.map((row) => (
                    <TableRow key={row.product_variant_id} hover>
                      <TableCell sx={{ fontWeight: 600, color: '#344054' }}>{row.sku}</TableCell>
                      <TableCell sx={{ minWidth: 280 }}>{row.display_name}</TableCell>
                      <TableCell>{row.unit ?? '-'}</TableCell>
                      <TableCell align="right">{row.on_hand.toLocaleString('vi-VN')}</TableCell>
                      <TableCell align="right" sx={{ minWidth: 140 }}>
                        {isCompletedAudit ? (
                          <Typography sx={{ fontWeight: 600, color: '#101828' }}>
                            {parseQty(row.actualQty)?.toLocaleString('vi-VN') ?? '-'}
                          </Typography>
                        ) : (
                          <TextField
                            fullWidth
                            size="small"
                            value={row.actualQty}
                            error={row.hasInvalidActualQty}
                            onChange={(event) => handleActualQtyChange(row.product_variant_id, event.target.value)}
                            slotProps={{
                              htmlInput: {
                                inputMode: 'text',
                                pattern: '-?[0-9]*',
                                style: { textAlign: 'right' },
                              },
                            }}
                          />
                        )}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 700,
                          color:
                            row.differenceQty === 0
                              ? '#667085'
                              : row.differenceQty > 0
                                ? '#067647'
                                : '#b42318',
                        }}
                      >
                        {row.differenceQty.toLocaleString('vi-VN')}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 700,
                          color:
                            row.varianceValue === 0
                              ? '#667085'
                              : row.varianceValue > 0
                                ? '#067647'
                                : '#b42318',
                        }}
                      >
                        {formatCurrency(row.varianceValue)}
                      </TableCell>
                      <TableCell align="right">
                        {isCompletedAudit ? null : (
                          <IconButton color="error" onClick={() => { handleRemoveRow(row.product_variant_id) }}>
                            <DeleteOutlineOutlinedIcon />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Stack>
      </Paper>
    </Stack>
  )
}
