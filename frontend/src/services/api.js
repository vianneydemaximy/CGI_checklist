/**
 * services/api.js
 * Axios instance pre-configured for the backend API.
 */
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// Response interceptor — surface error messages cleanly
api.interceptors.response.use(
  res => res,
  err => {
    const message = err.response?.data?.error || err.message || 'Unknown error'
    return Promise.reject(new Error(message))
  }
)

export default api