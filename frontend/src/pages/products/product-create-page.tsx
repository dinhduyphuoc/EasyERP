import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import { useNavigate, useParams } from 'react-router'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import CropOutlinedIcon from '@mui/icons-material/CropOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
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
import { productApi, type ProductCategory, type ProductUpsertPayload } from '@/pages/products/product.api'
import type { ProductDetailItem } from '@/pages/products/product-list.data'
import { defaultCardSx } from '@/shared/ui/paper'
import { CreateEditPageHeader } from '@/shared/ui/page'
import { appToast } from '@/shared/ui/toast/toast.helpers'
import { showErrorToast } from '@/shared/ui/toast/toast-error'
import { StackedTextField } from '@/shared/ui/form/stacked-text-field'
import { StackedDropdown } from '@/shared/ui/form/stacked-dropdown'
import { ManagedImageField, type ManagedImageFieldHandle } from '@/shared/ui/image'
import { UnsavedChangesBanner, useUnsavedChangesPrompt } from '@/shared/ui/unsaved-changes'
import { formatCurrencyInput as formatCurrency } from '@/shared/utils/currency'
import { isObjectUrl } from '@/shared/utils/image'
import { ProductPageSkeleton } from '@/pages/products/product-skeletons'

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
  image_url: string
}

type ProductFormSnapshot = {
  name: string
  sku: string
  unit: string
  status: 'active' | 'inactive' | 'draft' | 'deleted'
  category: string | null
  description: string
  basePrice: string
  baseCogs: string
  attributes: AttributeRow[]
  variants: VariantRow[]
  imagePreview: string
  variantSeedMap: Record<string, Pick<VariantRow, 'sku' | 'price' | 'cogs' | 'image_url'>>
  removedVariantIds: string[]
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
    image_url: '',
  }))
}

function buildVariantSeedMap(product: ProductDetailItem) {
  const seeds: Record<string, Pick<VariantRow, 'sku' | 'price' | 'cogs' | 'image_url'>> = {}
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
        image_url: variant.image_url ?? '',
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
        image_url: variant.image_url ?? '',
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
  const navigateTimeoutRef = useRef<number | null>(null)
  const mainImageFieldRef = useRef<ManagedImageFieldHandle | null>(null)
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
  const [isMainImageBusy, setIsMainImageBusy] = useState(false)
  const [busyVariantIds, setBusyVariantIds] = useState<string[]>([])
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false)
  const [variantSeedMap, setVariantSeedMap] = useState<Record<string, Pick<VariantRow, 'sku' | 'price' | 'cogs' | 'image_url'>>>({})
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([])
  const [initialSnapshot, setInitialSnapshot] = useState<ProductFormSnapshot | null>(null)

  useEffect(() => {
    setVariants((current) => {
      const next = buildVariants(attributes, sku).filter((item) => !removedVariantIds.includes(item.id))
      return next.map((item) => {
        const matched = current.find((row) => row.id === item.id)
        const seeded = variantSeedMap[item.id]
        return matched
          ? { ...item, price: matched.price, cogs: matched.cogs, sku: matched.sku || item.sku, image_url: matched.image_url }
          : seeded
            ? { ...item, price: seeded.price, cogs: seeded.cogs, sku: seeded.sku || item.sku, image_url: seeded.image_url }
            : item
      })
    })
  }, [attributes, sku, variantSeedMap, removedVariantIds])

  useEffect(() => {
    let cancelled = false

    const fetchPageData = async () => {
      setIsPageLoading(true)
      try {
        const categoryData = await productApi.getProductCategories()
        if (cancelled) {
          return
        }
        setCategories(categoryData)

        if (!id) {
          setVariantSeedMap({})
          setRemovedVariantIds([])
          setInitialSnapshot({
            name: '',
            sku: '',
            unit: '',
            status: 'active',
            category: null,
            description: '',
            basePrice: formatCurrency(0, { zeroAsEmpty: false }),
            baseCogs: formatCurrency(0, { zeroAsEmpty: false }),
            attributes: [],
            variants: [],
            imagePreview: '',
            variantSeedMap: {},
            removedVariantIds: [],
          })
          return
        }

        const product = await productApi.getProductById(id)
        if (cancelled || !product) {
          return
        }

        const categoryNameById = new Map(categoryData.map((item) => [item.id, item.category_name]))

        const nextName = product.product_name
        const nextSku = product.default_variant_sku ?? product.variants[0]?.sku.split('-').slice(0, -1).join('-') ?? ''
        const nextUnit = product.unit ?? ''
        const nextStatus = product.status ?? 'draft'
        const nextCategory = product.category_id ? categoryNameById.get(product.category_id) ?? null : null
        const nextDescription = product.description ?? ''
        const nextImagePreview = product.image_url ?? product.variants[0]?.image_url ?? ''

        setName(nextName)
        setSku(nextSku)
        setUnit(nextUnit)
        setStatus(nextStatus)
        setCategory(nextCategory)
        setDescription(nextDescription)
        setImagePreview(nextImagePreview)
        setHasAttemptedSave(false)
        setDirty(false)
        setRemovedVariantIds([])

        if (product.attributes.length === 0) {
          setAttributes([])
          const nextBasePrice = formatCurrency(product.base_price ?? product.variants[0]?.selling_price ?? '')
          const nextBaseCogs = formatCurrency(product.cogs ?? product.variants[0]?.cogs ?? '')
          setBasePrice(nextBasePrice)
          setBaseCogs(nextBaseCogs)
          setVariantSeedMap({})
          setInitialSnapshot({
            name: nextName,
            sku: nextSku,
            unit: nextUnit,
            status: nextStatus,
            category: nextCategory,
            description: nextDescription,
            basePrice: nextBasePrice,
            baseCogs: nextBaseCogs,
            attributes: [],
            variants: [],
            imagePreview: nextImagePreview,
            variantSeedMap: {},
            removedVariantIds: [],
          })
          return
        }

        const nextBasePrice = ''
        const nextBaseCogs = formatCurrency(product.cogs ?? '')
        const nextAttributes = product.attributes.map((attribute) => ({
          id: String(attribute.id),
          name: attribute.name,
          values: attribute.values.map((value) => value.value),
          draft: '',
        }))
        const nextVariantSeedMap = buildVariantSeedMap(product)
        const nextVariants = buildVariants(nextAttributes, nextSku).map((item) => {
          const seeded = nextVariantSeedMap[item.id]
          return seeded
            ? { ...item, price: seeded.price, cogs: seeded.cogs, sku: seeded.sku || item.sku, image_url: seeded.image_url }
            : item
        })

        setBasePrice(nextBasePrice)
        setBaseCogs(nextBaseCogs)
        setAttributes(nextAttributes)
        setVariantSeedMap(nextVariantSeedMap)
        setVariants(nextVariants)
        setInitialSnapshot({
          name: nextName,
          sku: nextSku,
          unit: nextUnit,
          status: nextStatus,
          category: nextCategory,
          description: nextDescription,
          basePrice: nextBasePrice,
          baseCogs: nextBaseCogs,
          attributes: nextAttributes,
          variants: nextVariants,
          imagePreview: nextImagePreview,
          variantSeedMap: nextVariantSeedMap,
          removedVariantIds: [],
        })
      } catch (error) {
        if (cancelled) {
          return
        }
        console.error('Lỗi khi lấy dữ liệu sản phẩm:', error)
        appToast.error('Không thể tải dữ liệu sản phẩm. Vui lòng thử lại!')
      } finally {
        if (!cancelled) {
          setIsPageLoading(false)
        }
      }
    }

    void fetchPageData()

    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    return () => {
      if (navigateTimeoutRef.current !== null) {
        window.clearTimeout(navigateTimeoutRef.current)
      }
    }
  }, [])

  const variantMode = variants.length > 0
  const isEditMode = Boolean(id)
  const setVariantImageBusy = (variantId: string, busy: boolean) => {
    setBusyVariantIds((current) =>
      busy ? [...new Set([...current, variantId])] : current.filter((item) => item !== variantId),
    )
  }
  const validationErrors = useMemo(() => {
    const nextErrors: Record<string, string> = {}

    if (!name.trim()) {
      nextErrors.name = 'Tên sản phẩm là bắt buộc.'
    }
    if (!sku.trim()) {
      nextErrors.sku = 'Mã sản phẩm là bắt buộc.'
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

  const canSave =
    !isPageLoading &&
    !isSaving &&
    !isMainImageBusy &&
    busyVariantIds.length === 0 &&
    Object.keys(validationErrors).length === 0 &&
    (!isEditMode || dirty)

  const handleSave = async () => {
    setHasAttemptedSave(true)

    if (isMainImageBusy) {
      appToast.warning('Ảnh đang được tải lên. Vui lòng đợi hoàn tất rồi lưu lại.')
      return
    }

    if (busyVariantIds.length > 0) {
      appToast.warning('Ảnh phiên bản chưa tải lên hoàn tất. Vui lòng đợi upload xong rồi lưu lại.')
      return
    }

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
        default_variant_sku: variantMode ? undefined : sku.trim() || undefined,
        unit: unit.trim() || undefined,
        status,
        image_url: imagePreview.trim() && !isObjectUrl(imagePreview.trim()) ? imagePreview.trim() : null,
        category,
        description: description.trim() || undefined,
        base_price: variantMode ? null : parseCurrency(basePrice),
        cogs: variantMode ? null : baseCogs.trim() ? parseCurrency(baseCogs) : null,
        attributes: normalizedAttributes,
        variants: variantMode
          ? variants.map((variant) => {
              const sellingPrice = parseCurrency(variant.price)
              const cogs = parseCurrency(variant.cogs)

              return {
                name: variant.name,
                sku: variant.sku.trim(),
                kind: 'generated',
                selling_price: sellingPrice,
                cogs,
                image_url: variant.image_url.trim() && !isObjectUrl(variant.image_url.trim()) ? variant.image_url.trim() : null,
                combinations: getVariantCombinations(variant),
              }
            })
          : [],
      }

      if (isEditMode && id) {
        await productApi.updateProduct(id, payload)
        appToast.success('Cập nhật sản phẩm thành công.')
        navigateTimeoutRef.current = window.setTimeout(() => navigate('/products'), 1000)
      } else {
        await productApi.createProduct(payload)
        appToast.success('Thêm sản phẩm thành công.')
        navigateTimeoutRef.current = window.setTimeout(() => navigate('/products'), 1000)
      }

      setDirty(false)
      setHasAttemptedSave(false)
      setInitialSnapshot({
        name,
        sku,
        unit,
        status,
        category,
        description,
        basePrice,
        baseCogs,
        attributes,
        variants,
        imagePreview,
        variantSeedMap,
        removedVariantIds,
      })
    } catch (error) {
      console.error('Lỗi khi lưu sản phẩm:', error)
      showErrorToast(error, 'Có lỗi xảy ra khi lưu sản phẩm. Vui lòng thử lại!')
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
        return { ...item, values: uniqueValues, draft: '' }
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

  const handleDiscard = () => {
    if (!initialSnapshot) {
      return
    }

    setName(initialSnapshot.name)
    setSku(initialSnapshot.sku)
    setUnit(initialSnapshot.unit)
    setStatus(initialSnapshot.status)
    setCategory(initialSnapshot.category)
    setDescription(initialSnapshot.description)
    setBasePrice(initialSnapshot.basePrice)
    setBaseCogs(initialSnapshot.baseCogs)
    setAttributes(initialSnapshot.attributes)
    setVariants(initialSnapshot.variants)
    setImagePreview(initialSnapshot.imagePreview)
    setVariantSeedMap(initialSnapshot.variantSeedMap)
    setRemovedVariantIds(initialSnapshot.removedVariantIds)
    setHasAttemptedSave(false)
    setDirty(false)
  }
  const { bannerProps, attemptNavigate } = useUnsavedChangesPrompt({
    isDirty: dirty,
    isSaving,
    onDiscard: handleDiscard,
    onSave: handleSave,
  })

  if (isPageLoading) {
    return <ProductPageSkeleton />
  }

  return (
    <Box sx={{ px: { xs: 2, md: 3, xl: 4 }, pb: 8 }}>
      <Box sx={{ mb: 2 }}>
        <CreateEditPageHeader
          title={isEditMode ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm'}
          onBack={() => attemptNavigate('/products')}
          actions={(
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                variant="contained"
                color="secondary"
                startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />}
                onClick={handleSave}
                disabled={!canSave}
              >
                {isSaving ? 'Đang lưu...' : isEditMode ? 'Cập nhật' : 'Lưu'}
              </Button>
            </Stack>
          )}
        />
      </Box>

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
                  <StackedTextField fullWidth label="Tên sản phẩm *" placeholder="Ví dụ: Túi deo chéo canvas" value={name} onChange={(event) => { setDirty(true); setName(event.target.value) }} error={Boolean(errors.name)} helperText={errors.name} />
                </Box>

                <StackedTextField fullWidth label="Mã sản phẩm *" placeholder="Ví dụ: TUI-CANVAS-01" value={sku} onChange={(event) => { setDirty(true); setSku(sanitizeSku(event.target.value)) }} error={Boolean(errors.sku)} helperText={errors.sku} />

                <StackedTextField fullWidth label="Đơn vị" placeholder="Ví dụ: cái, hộp, kg" value={unit} onChange={(event) => { setDirty(true); setUnit(event.target.value) }} />

                <StackedDropdown
                  fullWidth
                  label="Trạng thái"
                  value={status}
                  onChange={(event) => { setDirty(true); setStatus(event.target.value as 'active' | 'inactive' | 'draft') }}
                >
                  <MenuItem value="active">Đang bán</MenuItem>
                  <MenuItem value="inactive">Ngưng bán</MenuItem>
                  <MenuItem value="draft">Nháp</MenuItem>
                </StackedDropdown>

                <StackedDropdown
                  fullWidth
                  label="Danh mục"
                  value={category ?? ''}
                  displayEmpty
                  onChange={(event) => {
                    setDirty(true)
                    const nextValue = event.target.value as string
                    setCategory(nextValue || null)
                  }}
                >
                  <MenuItem value="">Chọn danh mục sản phẩm</MenuItem>
                  {categories.map((item) => (
                    <MenuItem key={item.id} value={item.category_name}>
                      {item.category_name}
                    </MenuItem>
                  ))}
                </StackedDropdown>

                <Box sx={{ gridColumn: '1 / -1' }}>
                  <StackedTextField fullWidth multiline minRows={6} label="Mô tả sản phẩm" placeholder="Mô tả ngắn về chất liệu, công năng, điểm nổi bật của sản phẩm..." value={description} onChange={(event) => { setDirty(true); setDescription(event.target.value) }} />
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
                    <StackedTextField
                      fullWidth
                      label="Giá bán"
                      value={basePrice}
                      onChange={(event) => { setDirty(true); setBasePrice(formatCurrency(event.target.value, { zeroAsEmpty: false })) }}
                      error={Boolean(errors.basePrice)}
                      helperText={errors.basePrice}
                      endAdornment={<InputAdornment sx={{ fontSize: 14 }} position="end">đ</InputAdornment>}
                    />
                    <StackedTextField
                      fullWidth
                      label="Giá vốn"
                      value={baseCogs}
                      onChange={(event) => { setDirty(true); setBaseCogs(formatCurrency(event.target.value, { zeroAsEmpty: false })) }}
                      endAdornment={<InputAdornment sx={{ fontSize: 14 }} position="end">đ</InputAdornment>}
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
                  <Table sx={{ width: '100%', tableLayout: 'fixed' }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        <TableCell sx={{ width: '10%', pr: 0.5 }}></TableCell>
                        <TableCell sx={{ width: '20%', pl: 0.5 }}>Biến thể</TableCell>
                        <TableCell sx={{ width: '24%' }}>SKU *</TableCell>
                        <TableCell sx={{ width: '19%' }}>Giá bán</TableCell>
                        <TableCell sx={{ width: '19%' }}>Giá vốn</TableCell>
                        <TableCell sx={{ width: '8%'}} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {variants.map((variant) => (
                        <TableRow key={variant.id} hover>
                          <TableCell sx={{ pl: 2, pr: 0.5 }}>
                            <ManagedImageField
                              value={variant.image_url}
                              onChange={(nextValue) => {
                                setDirty(true)
                                setVariants((current) =>
                                  current.map((item) => (item.id === variant.id ? { ...item, image_url: nextValue } : item)),
                                )
                              }}
                              onBusyChange={(busy) => setVariantImageBusy(variant.id, busy)}
                              uploadImage={productApi.uploadProductImage}
                              cropImage={productApi.cropProductImage}
                              placeholder={<ImageOutlinedIcon sx={{ color: '#667085' }} />}
                              holderWidth={56}
                              holderHeight={56}
                              useTooltip
                              cropLabel="Cắt"
                              removeLabel="Xóa"
                              cropDialogTitle={`Cắt ảnh phiên bản ${variant.name}`}
                              uploadErrorMessage="Không thể tải ảnh. Vui lòng thử lại!"
                              cropErrorMessage="Không thể cắt ảnh. Vui lòng thử lại!"
                              holderSx={{
                                borderRadius: 2.5,
                                border: '1px dashed #cbd5e1',
                                bgcolor: '#f8fafc',
                              }}
                              onRemove={() => {
                                setDirty(true)
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ pl: 0.5, pr: 2 }}>
                            <Typography sx={{ fontWeight: 600, color: '#0f172a' }}>{variant.name}</Typography>
                          </TableCell>
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
                                  endAdornment: <InputAdornment position="end">đ</InputAdornment>,
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
                                  endAdornment: <InputAdornment position="end">đ</InputAdornment>,
                                },
                              }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              color="error"
                              size="small"
                              aria-label={`Xóa phiên bản ${variant.name}`}
                              onClick={() => { setDirty(true); setRemovedVariantIds((current) => [...new Set([...current, variant.id])]) }}
                              sx={{
                                border: '1px solid #f3d0d0',
                                borderRadius: 2,
                                bgcolor: '#fff5f5',
                              }}
                            >
                              <DeleteOutlineOutlinedIcon fontSize="small" />
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
                      <Box key={attribute.id} sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1.4fr auto' } }}>
                        <StackedTextField label="Tên thuộc tính" placeholder="Ví dụ: Màu sắc" value={attribute.name} onChange={(event) => { setDirty(true); setAttributes((current) => current.map((item) => item.id === attribute.id ? { ...item, name: event.target.value } : item)) }} />

                        <Box>
                          <StackedTextField
                            fullWidth
                            label="Giá trị"
                            placeholder={attribute.values.length === 0 ? 'Nhập giá trị rồi nhấn Enter' : 'Nhập thêm giá trị'}
                            value={attribute.draft}
                            onChange={(event) => {
                              setDirty(true)
                              setAttributes((current) => current.map((item) => item.id === attribute.id ? { ...item, draft: event.target.value } : item))
                            }}
                            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => handleAttributeKeyDown(event, attribute.id)}
                            onBlur={() => commitAttributeValues(attribute.id)}
                            error={Boolean(errors[`attr-${attribute.id}`])}
                            helperText={errors[`attr-${attribute.id}`] || 'Nhấn Enter để thêm từng giá trị. Ví dụ: Đỏ, Xanh, Đen'}
                            startAdornment={
                              attribute.values.length > 0 ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, mr: 0.75, py: 0.5 }}>
                                  {attribute.values.map((value) => (
                                    <Chip
                                      key={value}
                                      label={value}
                                      size="small"
                                      onDelete={() => {
                                        setDirty(true)
                                        setAttributes((current) =>
                                          current.map((item) =>
                                            item.id === attribute.id
                                              ? { ...item, values: item.values.filter((entry) => entry !== value) }
                                              : item,
                                          ),
                                        )
                                      }}
                                      sx={{
                                        bgcolor: '#eef4ff',
                                        color: '#284b9b',
                                        fontWeight: 600,
                                        '& .MuiChip-deleteIcon': {
                                          color: '#284b9b',
                                        },
                                      }}
                                    />
                                  ))}
                                </Box>
                              ) : undefined
                            }
                            inputSx={{
                              display: 'flex',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 0.75,
                              py: 0.5,
                              '& .MuiOutlinedInput-input': {
                                minWidth: 120,
                                flex: 1,
                                py: 1,
                              },
                            }}
                          />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', pt: { md: 3.5 } }}>
                          <IconButton
                            color="error"
                            size="small"
                            aria-label={`Xóa thuộc tính ${attribute.name || 'mới'}`}
                            onClick={() => { setDirty(true); setAttributes((current) => current.filter((item) => item.id !== attribute.id)) }}
                            sx={{
                              width: 32,
                              height: 32,
                              flex: '0 0 auto',
                              alignSelf: 'flex-start',
                              border: '1px solid #f3d0d0',
                              borderRadius: 2,
                              bgcolor: '#fff5f5',
                            }}
                          >
                            <DeleteOutlineOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Box>
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
                  Chọn hoặc kéo thả ảnh vào đây để tải ảnh.
                </Typography>
              </Box>

              <ManagedImageField
                ref={mainImageFieldRef}
                value={imagePreview}
                onChange={(nextValue) => {
                  setDirty(true)
                  setImagePreview(nextValue)
                }}
                onRemove={() => {
                  setDirty(true)
                  setImagePreview('')
                }}
                onBusyChange={setIsMainImageBusy}
                uploadImage={productApi.uploadProductImage}
                cropImage={productApi.cropProductImage}
                placeholder={(
                  <Stack spacing={1} sx={{ alignItems: 'center' }}>
                    <CloudUploadOutlinedIcon sx={{ fontSize: 40 }} />
                    <Typography sx={{ fontWeight: 700 }}>Chọn hoặc kéo thả ảnh sản phẩm</Typography>
                    <Typography variant="body2" sx={{ color: '#667085' }}>
                      Hỗ trợ JPG, PNG. Tự động resize tối đa 720p trước khi tải lên.
                    </Typography>
                  </Stack>
                )}
                holderWidth="100%"
                holderHeight="same-as-width"
                cropPreviewToHolder
                useTooltip={false}
                cropDialogTitle="Cắt ảnh sản phẩm"
                uploadErrorMessage="Không thể tải ảnh lên. Vui lòng thử lại!"
                holderSx={{
                  borderRadius: '18px',
                  border: '1.5px dashed #b8c5db',
                  background: 'linear-gradient(180deg,#f8fbff 0%,#eef4ff 100%)',
                  textAlign: 'center',
                  color: '#3658a7',
                }}
                imageSx={{ borderRadius: '14px' }}
                overlaySx={{ bgcolor: 'rgba(15, 23, 42, 0.12)' }}
              />

              <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<CropOutlinedIcon fontSize="small" />}
                  onClick={() => mainImageFieldRef.current?.openCrop()}
                  disabled={!imagePreview || isMainImageBusy}
                >
                  Cắt
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DeleteOutlineOutlinedIcon fontSize="small" />}
                  onClick={() => {
                    setDirty(true)
                    setImagePreview('')
                    mainImageFieldRef.current?.remove()
                  }}
                  disabled={!imagePreview || isMainImageBusy}
                >
                  Xóa
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Stack>
      </Box>

      <UnsavedChangesBanner {...bannerProps} />
    </Box>
  )
}
