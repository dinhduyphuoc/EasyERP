import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Alert, Box, IconButton, Paper, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { defaultCardSx } from '@/shared/ui/paper'

function InventoryProductCellSkeleton() {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 280 }}>
      <Skeleton variant="rounded" width={52} height={52} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Skeleton variant="text" width="52%" height={28} />
      </Box>
    </Stack>
  )
}

export function InventoryStockTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Table>
      <TableHead sx={{ backgroundColor: '#f4f6f8' }}>
        <TableRow>
          <TableCell>Sản phẩm</TableCell>
          <TableCell>SKU</TableCell>
          <TableCell>Đơn vị tính</TableCell>
          <TableCell align="right">Tồn kho</TableCell>
          <TableCell align="right">Có thể bán</TableCell>
          <TableCell align="right">Đang giao dịch</TableCell>
          <TableCell align="right">Đang đóng gói</TableCell>
          <TableCell align="right">Đang về kho</TableCell>
          <TableCell align="right">Giá bán</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {Array.from({ length: rows }).map((_, index) => (
          <TableRow key={index}>
            <TableCell>
              <InventoryProductCellSkeleton />
            </TableCell>
            <TableCell><Skeleton variant="text" width="70%" height={24} /></TableCell>
            <TableCell><Skeleton variant="text" width="56%" height={24} /></TableCell>
            <TableCell align="right"><Skeleton variant="text" width={32} height={24} sx={{ ml: 'auto' }} /></TableCell>
            <TableCell align="right"><Skeleton variant="text" width={36} height={24} sx={{ ml: 'auto' }} /></TableCell>
            <TableCell align="right"><Skeleton variant="text" width={40} height={24} sx={{ ml: 'auto' }} /></TableCell>
            <TableCell align="right"><Skeleton variant="text" width={42} height={24} sx={{ ml: 'auto' }} /></TableCell>
            <TableCell align="right"><Skeleton variant="text" width={38} height={24} sx={{ ml: 'auto' }} /></TableCell>
            <TableCell align="right"><Skeleton variant="text" width="52%" height={24} sx={{ ml: 'auto' }} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function InventoryHistoryTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Table>
      <TableHead sx={{ backgroundColor: '#f4f6f8' }}>
        <TableRow>
          <TableCell>Thời gian</TableCell>
          <TableCell>Loại thay đổi</TableCell>
          <TableCell>Hành động</TableCell>
          <TableCell>Người thay đổi</TableCell>
          <TableCell align="right">Tồn kho</TableCell>
          <TableCell align="right">Có thể bán</TableCell>
          <TableCell align="right">Đang giao dịch</TableCell>
          <TableCell align="right">Đang đóng gói</TableCell>
          <TableCell align="right">Đang về kho</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {Array.from({ length: rows }).map((_, index) => (
          <TableRow key={index}>
            <TableCell><Skeleton variant="text" width="72%" height={24} /></TableCell>
            <TableCell><Skeleton variant="text" width="64%" height={24} /></TableCell>
            <TableCell><Skeleton variant="text" width="58%" height={24} /></TableCell>
            <TableCell><Skeleton variant="text" width="66%" height={24} /></TableCell>
            <TableCell align="right"><Skeleton variant="text" width={32} height={24} sx={{ ml: 'auto' }} /></TableCell>
            <TableCell align="right"><Skeleton variant="text" width={36} height={24} sx={{ ml: 'auto' }} /></TableCell>
            <TableCell align="right"><Skeleton variant="text" width={40} height={24} sx={{ ml: 'auto' }} /></TableCell>
            <TableCell align="right"><Skeleton variant="text" width={42} height={24} sx={{ ml: 'auto' }} /></TableCell>
            <TableCell align="right"><Skeleton variant="text" width={38} height={24} sx={{ ml: 'auto' }} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function InventoryAuditListTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Table>
      <TableHead sx={{ backgroundColor: '#f4f6f8' }}>
        <TableRow>
          <TableCell>Phiếu kiểm kho</TableCell>
          <TableCell>Trạng thái</TableCell>
          <TableCell>Ngày lập phiếu</TableCell>
          <TableCell>Ngày chỉnh sửa</TableCell>
          <TableCell>Ngày kiểm</TableCell>
          <TableCell align="right">Số dòng</TableCell>
          <TableCell align="right">Đã kiểm</TableCell>
          <TableCell align="right">Dòng lệch</TableCell>
          <TableCell align="right">Tổng SL lệch</TableCell>
          <TableCell>Ghi chú</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {Array.from({ length: rows }).map((_, index) => (
          <TableRow key={index}>
            <TableCell>
              <Box>
                <Skeleton variant="text" width="46%" height={26} />
                <Skeleton variant="text" width="62%" height={20} />
              </Box>
            </TableCell>
            <TableCell><Skeleton variant="rounded" width={88} height={26} /></TableCell>
            <TableCell><Skeleton variant="text" width="70%" height={24} /></TableCell>
            <TableCell><Skeleton variant="text" width="70%" height={24} /></TableCell>
            <TableCell><Skeleton variant="text" width="70%" height={24} /></TableCell>
            <TableCell align="right"><Skeleton variant="text" width={24} height={24} sx={{ ml: 'auto' }} /></TableCell>
            <TableCell align="right"><Skeleton variant="text" width={24} height={24} sx={{ ml: 'auto' }} /></TableCell>
            <TableCell align="right"><Skeleton variant="text" width={24} height={24} sx={{ ml: 'auto' }} /></TableCell>
            <TableCell align="right"><Skeleton variant="text" width={38} height={24} sx={{ ml: 'auto' }} /></TableCell>
            <TableCell><Skeleton variant="text" width="76%" height={24} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function InventoryAuditPageSkeleton() {
  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <IconButton
          disabled
          sx={{
            border: '1px solid #d0d5dd',
            borderRadius: '4px',
            color: '#344054',
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Skeleton variant="text" width={240} height={38} />
      </Stack>

      <Paper sx={defaultCardSx}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} sx={{ justifyContent: 'space-between' }}>
          <Box>
            <Skeleton variant="text" width={90} height={22} />
            <Skeleton variant="text" width={140} height={34} />
          </Box>
          <Box>
            <Skeleton variant="text" width={90} height={22} />
            <Skeleton variant="text" width={120} height={34} />
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Skeleton variant="rounded" width={120} height={40} />
            <Skeleton variant="rounded" width={100} height={40} />
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={defaultCardSx}>
        <Stack spacing={2}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#101828' }}>
            Bảng kiểm kho
          </Typography>

          <Skeleton variant="rounded" width="100%" height={56} />
          <Alert severity="info">Đang tải dữ liệu tồn kho...</Alert>

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
              {Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton variant="text" width="72%" height={24} /></TableCell>
                  <TableCell sx={{ minWidth: 280 }}><Skeleton variant="text" width="86%" height={24} /></TableCell>
                  <TableCell><Skeleton variant="text" width="52%" height={24} /></TableCell>
                  <TableCell align="right"><Skeleton variant="text" width={32} height={24} sx={{ ml: 'auto' }} /></TableCell>
                  <TableCell align="right"><Skeleton variant="rounded" width={96} height={40} sx={{ ml: 'auto' }} /></TableCell>
                  <TableCell align="right"><Skeleton variant="text" width={32} height={24} sx={{ ml: 'auto' }} /></TableCell>
                  <TableCell align="right"><Skeleton variant="text" width={64} height={24} sx={{ ml: 'auto' }} /></TableCell>
                  <TableCell align="right"><Skeleton variant="rounded" width={28} height={28} sx={{ ml: 'auto' }} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Stack>
      </Paper>
    </Stack>
  )
}
