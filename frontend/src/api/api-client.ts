import axios from 'axios'

// Khởi tạo một instance của axios với các cấu hình mặc định
export const apiClient = axios.create({
  // Sử dụng biến môi trường cho baseURL, hoặc fallback về localhost
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001', 
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const ACTIVE_STORE_STORAGE_KEY = 'active_store_id'

// Request Interceptor: Được gọi trước khi một request được gửi đi
apiClient.interceptors.request.use(
  (config) => {
    // Lấy token từ localStorage (hoặc từ Zustand/Redux nếu bạn đang dùng State Manager)
    const token = localStorage.getItem('access_token') 
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    const activeStoreId = localStorage.getItem(ACTIVE_STORE_STORAGE_KEY)
    if (activeStoreId && config.headers) {
      config.headers['X-Store-Id'] = activeStoreId
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// Response Interceptor: Được gọi trước khi response trả về cho phía component
apiClient.interceptors.response.use(
  (response) => {
    // Chỉ trả về data thực tế thay vì toàn bộ object response của axios để code gọi API gọn hơn
    return response.data
  },
  (error) => {
    if (error.response) {
      // Bắt các lỗi chung như 401 Unauthorized
      if (error.response.status === 401) {
        console.error('Phiên đăng nhập đã hết hạn.')
        // TODO: Thực hiện logic redirect về trang login, hoặc tự động gọi API refresh_token ở đây
      }
    } else {
      console.error('Không thể kết nối đến máy chủ.')
    }
    return Promise.reject(error)
  },
)
