import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import Cropper, { type Area, type Point } from 'react-easy-crop'
import CropOutlinedIcon from '@mui/icons-material/CropOutlined'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Paper,
  Slider,
  type SxProps,
  type Theme,
} from '@mui/material'
import { showErrorToast } from '@/shared/ui/toast/toast-error'
import { cropImageFileToSize, preloadImageUrl, resizeImageFileToMax720p } from '@/shared/utils/image'

type ResponsiveLength = number | string | Record<string, number | string>
type HolderHeightValue = ResponsiveLength | 'same-as-width'

type UploadImageResult = {
  image_url: string
}

type CropPayload = {
  image_url: string
  crop: {
    x: number
    y: number
    width: number
    height: number
  }
}

export type ManagedImageFieldProps = {
  value: string
  onChange: (nextValue: string) => void
  uploadImage: (file: File, onProgress?: (progress: number) => void) => Promise<UploadImageResult>
  cropImage?: (payload: CropPayload) => Promise<UploadImageResult>
  onBusyChange?: (busy: boolean) => void
  onRemove?: () => void
  placeholder: ReactNode
  holderWidth?: ResponsiveLength
  holderHeight?: HolderHeightValue
  useTooltip?: boolean
  cropLabel?: string
  removeLabel?: string
  cropDialogTitle?: string
  cropApplyLabel?: string
  cropAspect?: number
  disabled?: boolean
  accept?: string
  holderSx?: SxProps<Theme>
  imageSx?: SxProps<Theme>
  overlaySx?: SxProps<Theme>
  cropPreviewToHolder?: boolean
  uploadErrorMessage?: string
  cropErrorMessage?: string
}

export type ManagedImageFieldHandle = {
  openCrop: () => void
  openFilePicker: () => void
  remove: () => void
}

function ImageProcessingOverlay({
  progress,
  sx,
}: {
  progress: number | null
  sx?: SxProps<Theme>
}) {
  return (
    <Box
      sx={[
        {
          position: 'absolute',
          inset: 0,
          bgcolor: 'rgba(15, 23, 42, 0.18)',
          display: 'flex',
          alignItems: 'flex-end',
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <LinearProgress
        variant={progress !== null ? 'determinate' : 'indeterminate'}
        value={progress ?? undefined}
        sx={{
          width: '100%',
          height: 6,
          bgcolor: 'rgba(255,255,255,0.35)',
          '& .MuiLinearProgress-bar': {
            bgcolor: '#ffffff',
          },
        }}
      />
    </Box>
  )
}

export const ManagedImageField = forwardRef<ManagedImageFieldHandle, ManagedImageFieldProps>(function ManagedImageField({
  value,
  onChange,
  uploadImage,
  cropImage,
  onBusyChange,
  onRemove,
  placeholder,
  holderWidth = '100%',
  holderHeight = 56,
  useTooltip = false,
  cropLabel = 'Cắt hình',
  removeLabel = 'Xóa',
  cropDialogTitle = 'Cắt ảnh',
  cropApplyLabel = 'Áp dụng crop',
  cropAspect = 1,
  disabled = false,
  accept = 'image/jpeg,image/png',
  holderSx,
  imageSx,
  overlaySx,
  cropPreviewToHolder = false,
  uploadErrorMessage = 'Không thể tải ảnh lên. Vui lòng thử lại!',
  cropErrorMessage = 'Không thể crop ảnh. Vui lòng thử lại!',
}: ManagedImageFieldProps, ref) {
  const holderRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const hoverTimeoutRef = useRef<number | null>(null)
  const localPreviewUrlRef = useRef<string | null>(null)
  const latestCommittedUrlRef = useRef(value)

  const [displayUrl, setDisplayUrl] = useState(value)
  const [hovered, setHovered] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [cropOpen, setCropOpen] = useState(false)
  const [cropPosition, setCropPosition] = useState<Point>({ x: 0, y: 0 })
  const [cropZoom, setCropZoom] = useState(1)
  const [cropAreaPixels, setCropAreaPixels] = useState<Area | null>(null)

  useEffect(() => {
    latestCommittedUrlRef.current = value
    if (!value) {
      clearLocalPreview()
      setDisplayUrl('')
      return
    }

    if (!localPreviewUrlRef.current) {
      setDisplayUrl(value)
    }
  }, [value])

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current !== null) {
        window.clearTimeout(hoverTimeoutRef.current)
      }

      if (localPreviewUrlRef.current) {
        URL.revokeObjectURL(localPreviewUrlRef.current)
      }
    }
  }, [])

  const notifyBusyChange = (busy: boolean) => {
    setIsBusy(busy)
    onBusyChange?.(busy)
  }

  const clearHoverTimeout = () => {
    if (hoverTimeoutRef.current !== null) {
      window.clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }

  const openTooltip = () => {
    if (!useTooltip || !displayUrl || disabled || isBusy) {
      return
    }

    clearHoverTimeout()
    setHovered(true)
  }

  const closeTooltip = () => {
    clearHoverTimeout()
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHovered(false)
      hoverTimeoutRef.current = null
    }, 120)
  }

  const clearLocalPreview = () => {
    if (localPreviewUrlRef.current) {
      URL.revokeObjectURL(localPreviewUrlRef.current)
      localPreviewUrlRef.current = null
    }
  }

  const handleUpload = async (file: File) => {
    notifyBusyChange(true)
    setProgress(0)
    const processedFile = await resizeImageFileToMax720p(file)
    const holderBounds = holderRef.current?.getBoundingClientRect()
    const shouldUseHolderPreview =
      cropPreviewToHolder && holderBounds && holderBounds.width > 0 && holderBounds.height > 0
    const previewFile = shouldUseHolderPreview
      ? await cropImageFileToSize(processedFile, holderBounds.width, holderBounds.height)
      : processedFile
    const previewUrl = URL.createObjectURL(previewFile)
    clearLocalPreview()
    localPreviewUrlRef.current = previewUrl
    setDisplayUrl(previewUrl)

    try {
      const uploaded = await uploadImage(processedFile, setProgress)
      await preloadImageUrl(uploaded.image_url)
      latestCommittedUrlRef.current = uploaded.image_url
      onChange(uploaded.image_url)
      if (!shouldUseHolderPreview) {
        clearLocalPreview()
        setDisplayUrl(uploaded.image_url)
      }
    } catch (error) {
      clearLocalPreview()
      setDisplayUrl(latestCommittedUrlRef.current)
      throw error
    } finally {
      notifyBusyChange(false)
      setProgress(null)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || disabled || isBusy) {
      return
    }

    void handleUpload(file).catch((error) => {
      console.error('Managed image upload error:', error)
      showErrorToast(error, uploadErrorMessage)
    })
  }

  const handleSelectFile = () => {
    if (disabled || isBusy) {
      return
    }

    inputRef.current?.click()
  }

  const handleOpenCrop = () => {
    if (!cropImage || !displayUrl || disabled || isBusy) {
      return
    }

    clearHoverTimeout()
    setHovered(false)
    setCropPosition({ x: 0, y: 0 })
    setCropZoom(1)
    setCropAreaPixels(null)
    setCropOpen(true)
  }

  const closeCropDialog = () => {
    if (isBusy) {
      return
    }

    setCropOpen(false)
    setCropPosition({ x: 0, y: 0 })
    setCropZoom(1)
    setCropAreaPixels(null)
  }

  const handleApplyCrop = async () => {
    if (!cropImage || !displayUrl || !cropAreaPixels) {
      return
    }

    setCropOpen(false)
    notifyBusyChange(true)
    setProgress(null)

    try {
      const uploaded = await cropImage({
        image_url: latestCommittedUrlRef.current || displayUrl,
        crop: cropAreaPixels,
      })
      await preloadImageUrl(uploaded.image_url)
      clearLocalPreview()
      latestCommittedUrlRef.current = uploaded.image_url
      setDisplayUrl(uploaded.image_url)
      onChange(uploaded.image_url)
    } catch (error) {
      setDisplayUrl(latestCommittedUrlRef.current)
      throw error
    } finally {
      notifyBusyChange(false)
      setProgress(null)
    }
  }

  const handleRemove = () => {
    if (disabled || isBusy) {
      return
    }

    clearHoverTimeout()
    setHovered(false)
    clearLocalPreview()
    latestCommittedUrlRef.current = ''
    setDisplayUrl('')
    onChange('')
    onRemove?.()
  }

  useImperativeHandle(ref, () => ({
    openCrop: handleOpenCrop,
    openFilePicker: handleSelectFile,
    remove: handleRemove,
  }))

  const shouldMatchHeightToWidth = holderHeight === 'same-as-width'
  const cropSourceUrl = latestCommittedUrlRef.current || displayUrl

  return (
    <>
      <Box
        ref={holderRef}
        sx={{
          position: 'relative',
          width: holderWidth,
          height: shouldMatchHeightToWidth ? 'auto' : holderHeight,
          aspectRatio: shouldMatchHeightToWidth ? '1 / 1' : undefined,
          overflow: 'visible',
          zIndex: hovered ? 30 : 1,
        }}
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltip}
      >
        <Box
          component="button"
          type="button"
          onClick={handleSelectFile}
          disabled={disabled || isBusy}
          sx={[
            {
              width: '100%',
              height: '100%',
              p: 0,
              borderRadius: 2.5,
              border: '1px dashed #cbd5e1',
              bgcolor: '#f8fafc',
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
              cursor: disabled || isBusy ? 'default' : 'pointer',
              flexShrink: 0,
              appearance: 'none',
              position: 'relative',
            },
            ...(Array.isArray(holderSx) ? holderSx : holderSx ? [holderSx] : []),
          ]}
        >
          {displayUrl ? (
            <Box
              component="img"
              src={displayUrl}
              alt="Image field preview"
              sx={[
                {
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                },
                ...(Array.isArray(imageSx) ? imageSx : imageSx ? [imageSx] : []),
              ]}
            />
          ) : placeholder}

          {isBusy ? <ImageProcessingOverlay progress={progress} sx={overlaySx} /> : null}
        </Box>

        {useTooltip && displayUrl && hovered && !isBusy ? (
          <Paper
            elevation={8}
            onMouseEnter={openTooltip}
            onMouseLeave={closeTooltip}
            sx={{
              position: 'absolute',
              top: '50%',
              left: 'calc(100% + 10px)',
              transform: 'translateY(-50%)',
              px: 0.5,
              py: 0.5,
              borderRadius: 2,
              border: '1px solid #d0d5dd',
              bgcolor: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              zIndex: 1400,
              whiteSpace: 'nowrap',
              overflow: 'visible',
              '&::after': {
                content: '""',
                position: 'absolute',
                top: '50%',
                left: -7,
                width: 12,
                height: 12,
                bgcolor: '#ffffff',
                borderLeft: '1px solid #d0d5dd',
                borderBottom: '1px solid #d0d5dd',
                transform: 'translateY(-50%) rotate(45deg)',
                zIndex: -1,
              },
            }}
          >
            {cropImage ? (
              <Button size="small" variant="text" startIcon={<CropOutlinedIcon fontSize="small" />} onClick={handleOpenCrop} sx={{ minWidth: 0, px: 1.25 }}>
                {cropLabel}
              </Button>
            ) : null}
            <Button size="small" variant="text" onClick={handleRemove} sx={{ minWidth: 0, px: 1.25, color: '#d92d20' }}>
              {removeLabel}
            </Button>
          </Paper>
        ) : null}

        <input ref={inputRef} hidden type="file" accept={accept} onChange={handleFileChange} />
      </Box>

      {cropImage ? (
        <Dialog open={cropOpen} onClose={closeCropDialog} maxWidth="sm" fullWidth>
          <DialogTitle>{cropDialogTitle}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'grid', gap: 2 }}>
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  height: 360,
                  borderRadius: 3,
                  overflow: 'hidden',
                  bgcolor: '#101828',
                }}
              >
                {cropSourceUrl ? (
                  <Cropper
                    image={cropSourceUrl}
                    crop={cropPosition}
                    zoom={cropZoom}
                    aspect={cropAspect}
                    cropShape="rect"
                    showGrid
                    onCropChange={setCropPosition}
                    onZoomChange={setCropZoom}
                    onCropComplete={(_, croppedAreaPixels) => setCropAreaPixels(croppedAreaPixels)}
                  />
                ) : null}
              </Box>

              <Box>
                <Slider
                  min={1}
                  max={3}
                  step={0.1}
                  value={cropZoom}
                  onChange={(_, value) => setCropZoom(Array.isArray(value) ? value[0] ?? 1 : value)}
                />
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeCropDialog}>Hủy</Button>
            <Button
              variant="contained"
              onClick={() => {
                void handleApplyCrop().catch((error) => {
                  console.error('Managed image crop error:', error)
                  showErrorToast(error, cropErrorMessage)
                })
              }}
              disabled={!cropAreaPixels}
            >
              {cropApplyLabel}
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </>
  )
})
