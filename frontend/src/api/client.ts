import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

// Attach JWT to every request
apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('vapt_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally
apiClient.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('vapt_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default apiClient
