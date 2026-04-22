import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactElement } from 'react'
import { useNavigate, useParams } from 'react-router'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
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
import { productApi, type ProductCategory, type ProductUpsertPayload } from '@/pages/products/product.api'
import type { ProductListItem } from '@/pages/products/product-list.data'
import { defaultCardSx } from '@/shared/ui/paper'
import { appToast } from '@/shared/ui/toast/toast.helpers'

type AttributeRow = {
  id: string
  name: string
  values: string[]
  draft: string
}

type VariantRow = {
  id: string
  name: string
  sku: string
  price: string
  cogs: string
}

function sanitizeSku(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

function formatVariantSkuToken(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Đ/g, 'D')
    .replace(/đ/g, 'd')
    .trim()
    .toUpperCase()
    .replace(/[/\\]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function formatCurrency(value: string | number, options?: { zeroAsEmpty?: boolean }) {
  const digits = String(value).replace(/\D/g, '')
  const numeric = Number(digits || '0')

  if (numeric === 0) {
    return options?.zeroAsEmpty ?? true ? '' : '0'
  }

  return new Intl.NumberFormat('vi-VN').format(numeric)
}

function parseCurrency(value: string) {
  return Number(value.replace(/\D/g, '')) || 0
}

function createAttribute(): AttributeRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    values: [],
    draft: '',
  }
}

function buildVariants(attributes: AttributeRow[], baseSku: string): VariantRow[] {
  const active = attributes.filter((item) => item.name.trim() && item.values.length > 0)
  if (!active.length) {
    return []
  }

  const combinations = active.reduce<Array<Array<{ name: string; value: string }>>>((acc, attribute) => {
    if (!acc.length) {
      return attribute.values.map((value) => [{ name: attribute.name, value }])
    }

    return acc.flatMap((existing) =>
      attribute.values.map((value) => [...existing, { name: attribute.name, value }]),
    )
  }, [])

  return combinations.map((combination) => ({
    id: combination.map((item) => `${item.name}:${item.value}`).join('|'),
    name: combination.map((item) => item.value).join(' / '),
    sku: [baseSku || 'VAR', ...combination.map((item) => formatVariantSkuToken(item.value)).filter(Boolean)].join('-'),
    price: formatCurrency(0, { zeroAsEmpty: false }),
    cogs: formatCurrency(0, { zeroAsEmpty: false }),
  }))
}

function buildVariantSeedMap(product: ProductListItem) {
  const seeds: Record<string, Pick<VariantRow, 'sku' | 'price' | 'cogs'>> = {}
  const attributeNameById = new Map(product.attributes.map((attribute) => [attribute.id, attribute.name]))

  product.variants.forEach((variant) => {
    const keyFromAttributeValues = variant.attribute_values
      .map((attributeValue) => {
        const attributeName = attributeNameById.get(attributeValue.attribute_value.attribute_id) ?? ''
        return `${attributeName}:${attributeValue.attribute_value.value}`
      })
      .join('|')

    if (keyFromAttributeValues) {
      seeds[keyFromAttributeValues] = {
        sku: variant.sku,
        price: formatCurrency(variant.selling_price, { zeroAsEmpty: false }),
        cogs: formatCurrency(variant.cogs, { zeroAsEmpty: false }),
      }
      return
    }

    const matchedValues = product.attributes.flatMap((attribute) =>
      attribute.values
        .filter((value) => sanitizeSku(variant.sku).includes(formatVariantSkuToken(value.value)))
        .map((value) => `${attribute.name}:${value.value}`),
    )

    if (matchedValues.length > 0) {
      seeds[matchedValues.join('|')] = {
        sku: variant.sku,
        price: formatCurrency(variant.selling_price, { zeroAsEmpty: false }),
        cogs: formatCurrency(variant.cogs, { zeroAsEmpty: false }),
      }
    }
  })

  return seeds
}

function getVariantCombinations(variant: VariantRow) {
  return variant.id
    .split('|')
    .map((segment) => segment.split(':').slice(1).join(':').trim())
    .filter(Boolean)
}

export function ProductCreatePage(): ReactElement {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [unit, setUnit] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive' | 'draft' | 'deleted'>('active')
  const [category, setCategory] = useState<string | null>(null)
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [description, setDescription] = useState('')
  const [basePrice, setBasePrice] = useState(formatCurrency(0, { zeroAsEmpty: false }))
  const [baseCogs, setBaseCogs] = useState(formatCurrency(0, { zeroAsEmpty: false }))
  const [attributes, setAttributes] = useState<AttributeRow[]>([])
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [imagePreview, setImagePreview] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showExitDialog, setShowExitDialog] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false)
  const [variantSeedMap, setVariantSeedMap] = useState<Record<string, Pick<VariantRow, 'sku' | 'price' | 'cogs'>>>({})
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([])

  useEffect(() => {
    setVariants((current) => {
      const next = buildVariants(attributes, sku).filter((item) => !removedVariantIds.includes(item.id))
      return next.map((item) => {
        const matched = current.find((row) => row.id === item.id)
        const seeded = variantSeedMap[item.id]
        return matched
          ? { ...item, price: matched.price, cogs: matched.cogs, sku: matched.sku || item.sku }
          : seeded
            ? { ...item, price: seeded.price, cogs: seeded.cogs, sku: seeded.sku || item.sku }
            : item
      })
    })
  }, [attributes, sku, variantSeedMap, removedVariantIds])

  useEffect(() => {
    const fetchPageData = async () => {
      try {
        const categoryData = await productApi.getProductCategories()
        setCategories(categoryData)

        if (!id) {
          setVariantSeedMap({})
          setRemovedVariantIds([])
          return
        }

        const product = await productApi.getProductById(id)
        if (!product) {
          return
        }

        const categoryNameById = new Map(categoryData.map((item) => [item.id, item.category_name]))

        setName(product.product_name)
        setSku(product.sku ?? product.variants[0]?.sku.split('-').slice(0, -1).join('-') ?? '')
        setUnit(product.unit ?? '')
        setStatus(product.status ?? 'draft')
        setCategory(product.category_id ? categoryNameById.get(product.category_id) ?? null : null)
        setDescription(product.description ?? '')
        setImagePreview(product.image_url ?? product.variants[0]?.image_url ?? '')
        setHasAttemptedSave(false)
        setDirty(false)
        setRemovedVariantIds([])

        if (product.attributes.length === 0) {
          setAttributes([])
          setBasePrice(formatCurrency(product.base_price ?? product.variants[0]?.selling_price ?? ''))
          setBaseCogs(formatCurrency(product.cogs ?? product.variants[0]?.cogs ?? ''))
          setVariantSeedMap({})
          return
        }

        setBasePrice('')
        setBaseCogs(formatCurrency(product.cogs ?? ''))
        setAttributes(
          product.attributes.map((attribute) => ({
            id: String(attribute.id),
            name: attribute.name,
            values: attribute.values.map((value) => value.value),
            draft: '',
          })),
        )
        setVariantSeedMap(buildVariantSeedMap(product))
      } catch (error) {
        console.error('Lỗi khi lấy dữ liệu sản phẩm:', error)
        appToast.error('Không thể tải dữ liệu sản phẩm. Vui lòng thử lại!')
      }
    }

    fetchPageData()
  }, [id])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])

  const variantMode = variants.length > 0
  const isEditMode = Boolean(id)
  const categoryOptions = useMemo(
    () => categories.map((item) => item.category_name),
    [categories],
  )

  const validationErrors = useMemo(() => {
    const nextErrors: Record<string, string> = {}

    if (!name.trim()) {
      nextErrors.name = 'Tên sản phẩm là bắt buộc.'
    }
    if (!sku.trim()) {
      nextErrors.sku = 'Mã SKU gốc là bắt buộc.'
    }

    attributes.forEach((attribute) => {
      if (attribute.name.trim() && attribute.values.length === 0) {
        nextErrors[`attr-${attribute.id}`] = 'Cần ít nhất một giá trị.'
      }
    })

    return nextErrors
  }, [attributes, name, sku])

  useEffect(() => {
    setErrors(hasAttemptedSave ? validationErrors : {})
  }, [hasAttemptedSave, validationErrors])

  const canSave = !isSaving && Object.keys(validationErrors).length === 0 && (!isEditMode || dirty)

  const handleSave = async () => {
    setHasAttemptedSave(true)

    if (!canSave) {
      appToast.warning('Vui lòng nhập đầy đủ các trường bắt buộc trước khi lưu.')
      return
    }

    setIsSaving(true)
    try {
      const normalizedAttributes = attributes
        .map((attribute) => ({
          name: attribute.name.trim(),
          values: [...new Set(attribute.values.map((value) => value.trim()).filter(Boolean))],
        }))
        .filter((attribute) => attribute.name && attribute.values.length > 0)

      const payload: ProductUpsertPayload = {
        product_name: name.trim(),
        sku: sku.trim() || undefined,
        unit: unit.trim() || undefined,
        status,
        image_url: imagePreview.trim() ? imagePreview : null,
        category,
        description: description.trim() || undefined,
        base_price: variantMode ? null : parseCurrency(basePrice),
        cogs: baseCogs.trim() ? parseCurrency(baseCogs) : null,
        attributes: normalizedAttributes,
        variants: variantMode
          ? variants.map((variant) => {
              const sellingPrice = parseCurrency(variant.price)
              const cogs = parseCurrency(variant.cogs)

              return {
                name: variant.name,
                sku: variant.sku.trim(),
                selling_price: sellingPrice,
                cogs,
                combinations: getVariantCombinations(variant),
              }
            })
          : [],
      }

      if (isEditMode && id) {
        await productApi.updateProduct(id, payload)
        appToast.success('Cập nhật sản phẩm thành công.')
        window.setTimeout(() => navigate('/products'), 1000)
      } else {
        await productApi.createProduct(payload)
        appToast.success('Thêm sản phẩm thành công.')
        window.setTimeout(() => navigate('/products'), 1000)
      }

      setDirty(false)
      setHasAttemptedSave(false)
    } catch (error) {
      console.error('Lỗi khi lưu sản phẩm:', error)
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
          : 'Có lỗi xảy ra khi lưu sản phẩm. Vui lòng thử lại!'

      appToast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const commitAttributeValues = (id: string) => {
    setAttributes((current) =>
      current.map((item) => {
        if (item.id !== id) {
          return item
        }

        const nextValues = item.draft
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)

        const uniqueValues = [...new Set([...item.values, ...nextValues])]
        return { ...item, values: uniqueValues }
      }),
    )
  }

  const handleAttributeKeyDown = (event: KeyboardEvent<HTMLInputElement>, id: string) => {
    if (event.key !== 'Enter') {
      return
    }

    event.preventDefault()
    commitAttributeValues(id)
  }

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setDirty(true)
    setIsUploading(true)
    const previewUrl = URL.createObjectURL(file)
    setImagePreview(previewUrl)

    void (async () => {
      try {
        const uploaded = await productApi.uploadProductImage(file)
        setImagePreview(uploaded.image_url)
      } catch (error) {
        console.error('Lỗi khi tải ảnh sản phẩm:', error)
        setImagePreview('')

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
            : 'Không thể tải ảnh lên. Vui lòng thử lại!'

        appToast.error(message)
      } finally {
        URL.revokeObjectURL(previewUrl)
        setIsUploading(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    })()
  }

  return (
    <Box sx={{ px: { xs: 2, md: 3, xl: 4 }, pb: 8 }}>
      <Box sx={{
        mb: 2,
      }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', cursor: 'pointer' }} onClick={() => (dirty ? setShowExitDialog(true) : navigate('/products'))}>
              <Paper sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 1
              }}>
                <ArrowBackIcon sx={{color: '#344054' }} />
              </Paper>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#101828' }}>
              {isEditMode ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm'}
            </Typography>
            </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button variant="contained" color="secondary" startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />} onClick={handleSave} disabled={!canSave}>
              {isSaving ? 'Đang lưu...' : isEditMode ? 'Cập nhật' : 'Lưu'}
            </Button>
          </Stack>
        </Stack>
      </Box>

      {isUploading && (
        <Alert icon={<CircularProgress size={16} color="inherit" />} severity="info" sx={{ mb: 2 }}>
          Ðang xử lý...
        </Alert>
      )}

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 2fr) minmax(320px, 1fr)' } }}>
        <Stack spacing={3}>
          <Paper sx={defaultCardSx}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Thông tin chung
                </Typography>
              </Box>

              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <TextField fullWidth label="Tên sản phẩm *" placeholder="Ví dụ: Túi deo chéo canvas" value={name} onChange={(event) => { setDirty(true); setName(event.target.value) }} error={Boolean(errors.name)} helperText={errors.name} />
                </Box>

                <TextField fullWidth label="Mã SKU gốc *" placeholder="Ví dụ: TUI-CANVAS-01" value={sku} onChange={(event) => { setDirty(true); setSku(sanitizeSku(event.target.value)) }} error={Boolean(errors.sku)} helperText={errors.sku} />

                <TextField fullWidth label="Đơn vị tính" placeholder="Ví dụ: cái, hộp, kg" value={unit} onChange={(event) => { setDirty(true); setUnit(event.target.value) }} />

                <TextField
                  fullWidth
                  select
                  label="Trạng thái"
                  value={status}
                  onChange={(event) => { setDirty(true); setStatus(event.target.value as 'active' | 'inactive' | 'draft') }}
                  slotProps={{
                    select: {
                      native: true,
                    },
                  }}
                >
                  <option value="active">Đang bán</option>
                  <option value="inactive">Ngưng bán</option>
                  <option value="draft">Nháp</option>
                </TextField>

                <Autocomplete options={categoryOptions} value={category} onChange={(_, value) => { setDirty(true); setCategory(value) }} renderInput={(params) => <TextField {...params} label="Danh mục" placeholder="Chọn danh mục sản phẩm" />} />

                <Box sx={{ gridColumn: '1 / -1' }}>
                  <TextField fullWidth multiline minRows={6} label="Mô tả sản phẩm" placeholder="Mô tả ngắn về chất liệu, công năng, điểm nổi bật của sản phẩm..." value={description} onChange={(event) => { setDirty(true); setDescription(event.target.value) }} />
                </Box>
              </Box>
            </Stack>
          </Paper>
              {!variantMode && (
                <Paper variant="outlined" sx={defaultCardSx}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Thông tin giá
                  </Typography>
                  <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, mt: 2 }}>
                    <TextField
                      fullWidth
                      label="Giá bán"
                      value={basePrice}
                      onChange={(event) => { setDirty(true); setBasePrice(formatCurrency(event.target.value, { zeroAsEmpty: false })) }}
                      error={Boolean(errors.basePrice)}
                      helperText={errors.basePrice}
                      slotProps={{
                        input: {
                          endAdornment: <InputAdornment sx={{ fontSize: 14 }} position="end">₫</InputAdornment>,
                        },
                      }}
                    />
                    <TextField
                      fullWidth
                      label="Giá vốn"
                      value={baseCogs}
                      onChange={(event) => { setDirty(true); setBaseCogs(formatCurrency(event.target.value, { zeroAsEmpty: false })) }}
                      slotProps={{
                        input: {
                          endAdornment: <InputAdornment sx={{ fontSize: 14 }} position="end">₫</InputAdornment>,
                        },
                      }}
                    />
                  </Box>
                </Paper>
              )}
          {variantMode && (
            <Paper sx={defaultCardSx}>
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Phiên bản
                    </Typography>
                  </Box>
                  <Box sx={{ px: 1.5, py: 0.75, borderRadius: '4px', border: '1px solid #d0d5dd', bgcolor: '#f8fafc', fontSize: 14 }}>
                    {variants.length} phiên bản
                  </Box>
                </Stack>

                <Paper variant="outlined" sx={{ overflow: 'hidden', borderColor: '#eaecf0' }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        <TableCell sx={{ minWidth: 220 }}>Tên phiên bản</TableCell>
                        <TableCell sx={{ minWidth: 220 }}>SKU *</TableCell>
                        <TableCell sx={{ minWidth: 220 }}>Giá bán</TableCell>
                        <TableCell sx={{ minWidth: 220 }}>Giá vốn</TableCell>
                        <TableCell sx={{ width: 72 }} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {variants.map((variant) => (
                        <TableRow key={variant.id} hover>
                          <TableCell sx={{ fontWeight: 600, color: '#0f172a' }}>{variant.name}</TableCell>
                          <TableCell>
                            <TextField fullWidth size="small" value={variant.sku} onChange={(event) => { setDirty(true); setVariants((current) => current.map((item) => item.id === variant.id ? { ...item, sku: sanitizeSku(event.target.value) } : item)) }} />
                          </TableCell>
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              value={variant.price}
                              onChange={(event) => { setDirty(true); setVariants((current) => current.map((item) => item.id === variant.id ? { ...item, price: formatCurrency(event.target.value) } : item)) }}
                              slotProps={{
                                input: {
                                  endAdornment: <InputAdornment position="end">₫</InputAdornment>,
                                },
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              value={variant.cogs}
                              onChange={(event) => { setDirty(true); setVariants((current) => current.map((item) => item.id === variant.id ? { ...item, cogs: formatCurrency(event.target.value, { zeroAsEmpty: false }) } : item)) }}
                              slotProps={{
                                input: {
                                  endAdornment: <InputAdornment position="end">₫</InputAdornment>,
                                },
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <IconButton color="error" onClick={() => { setDirty(true); setRemovedVariantIds((current) => [...new Set([...current, variant.id])]) }}>
                              <DeleteOutlineOutlinedIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>

                {errors.variants && <Alert severity="error">{errors.variants}</Alert>}
              </Stack>
            </Paper>
          )}
          <Paper sx={defaultCardSx}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Thuộc tính
                  </Typography>
                </Box>
                <Button variant="outlined" size="small" onClick={() => { setDirty(true); setAttributes((current) => [...current, createAttribute()]) }}>
                  Thêm thuộc tính
                </Button>
              </Stack>

              {!attributes.length ? (
                <Box sx={{ py: 3, textAlign: 'center', color: '#667085' }}>
                  Chưa có thuộc tính nào. Bạn có thể lưu sản phẩm đơn hoặc thêm thuộc tính để tạo biến thể.
                </Box>
              ) : (
                <Stack spacing={1.5}>
                  {attributes.map((attribute) => (
                      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1.4fr auto' } }}>
                        <TextField label="Tên thuộc tính" placeholder="Ví dụ: Màu sắc" value={attribute.name} onChange={(event) => { setDirty(true); setAttributes((current) => current.map((item) => item.id === attribute.id ? { ...item, name: event.target.value } : item)) }} />

                        <Box>
                          <TextField fullWidth label="Giá trị" placeholder="Nhập giá trị rồi nhấn Enter" value={attribute.draft} onChange={(event) => { setDirty(true); setAttributes((current) => current.map((item) => item.id === attribute.id ? { ...item, draft: event.target.value } : item)) }} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => handleAttributeKeyDown(event, attribute.id)} onBlur={() => commitAttributeValues(attribute.id)} error={Boolean(errors[`attr-${attribute.id}`])} helperText={errors[`attr-${attribute.id}`] || 'Ví dụ: Đỏ, Xanh, Đen'} />
                          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1 }} useFlexGap>
                            {attribute.values.map((value) => (
                              <Box key={value} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.75, borderRadius: '999px', bgcolor: '#eef4ff', color: '#284b9b', fontSize: 14, fontWeight: 600 }}>
                                {value}
                                <IconButton size="small" sx={{ p: 0.25, color: 'inherit' }} onClick={() => { setDirty(true); setAttributes((current) => current.map((item) => item.id === attribute.id ? { ...item, values: item.values.filter((entry) => entry !== value) } : item)) }}>
                                  <DeleteOutlineOutlinedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Box>
                            ))}
                          </Stack>
                        </Box>
                        <Button color="error" onClick={() => { setDirty(true); setAttributes((current) => current.filter((item) => item.id !== attribute.id)) }}>
                          <DeleteOutlineOutlinedIcon sx={{ fontSize: 16 }} />
                        </Button>
                      </Box>
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>
        </Stack>

        <Stack spacing={3}>
          <Paper sx={defaultCardSx}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Hình ảnh
                </Typography>
                <Typography sx={{ color: '#667085', mt: 0.5 }}>
                  Chọn ảnh hoặc kéo thả. Ảnh sẽ được nén trước khi tải lên.
                </Typography>
              </Box>

              <Box onClick={() => fileInputRef.current?.click()} sx={{ minHeight: { xs: 240, md: 300 }, borderRadius: '18px', border: '1.5px dashed #b8c5db', background: 'linear-gradient(180deg,#f8fbff 0%,#eef4ff 100%)', display: 'grid', placeItems: 'center', cursor: 'pointer', overflow: 'hidden', p: 2, textAlign: 'center', color: '#3658a7' }}>
                {imagePreview ? (
                  <Box component="img" src={imagePreview} alt="Preview hình ảnh sản phẩm" sx={{ width: '100%', height: '100%', minHeight: 268, objectFit: 'cover', borderRadius: '14px' }} />
                ) : (
                  <Stack spacing={1} sx={{ alignItems: 'center' }}>
                    <CloudUploadOutlinedIcon sx={{ fontSize: 40 }} />
                    <Typography sx={{ fontWeight: 700 }}>Chọn hoặc kéo thả ảnh sản phẩm</Typography>
                    <Typography variant="body2" sx={{ color: '#667085' }}>
                      Hỗ trợ JPG, PNG, WEBP. Tự động resize tối đa 800px.
                    </Typography>
                  </Stack>
                )}
              </Box>

              <input ref={fileInputRef} hidden type="file" accept="image/*" onChange={handleImageChange} />

              {imagePreview && (
                <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                  <Button variant="outlined" size="small" startIcon={<DeleteOutlineOutlinedIcon />} onClick={() => { setDirty(true); setImagePreview('') }}>
                    Xóa ảnh
                  </Button>
                </Stack>
              )}
            </Stack>
          </Paper>
        </Stack>
      </Box>

      <Dialog open={showExitDialog} onClose={() => setShowExitDialog(false)}>
        <DialogTitle>Rời trang khi chưa lưu?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            Bạn đang có thay đổi chưa lưu. Nếu quay lại bây giờ, dữ liệu hiện tại sẽ bị mất.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowExitDialog(false)}>Ở lại</Button>
          <Button color="error" onClick={() => navigate('/products')}>
            Rời trang
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
