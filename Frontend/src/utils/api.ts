import axios, { type InternalAxiosRequestConfig } from 'axios';

const isProduction = typeof window !== 'undefined' && (window.location.protocol === 'https:' || !window.location.hostname.includes('localhost'));

const USER_SERVICE_URL = import.meta.env.VITE_USER_SERVICE_URL || (isProduction ? '/api/v1' : 'http://localhost:5000/api/v1');
const CHAT_SERVICE_URL = import.meta.env.VITE_CHAT_SERVICE_URL || (isProduction ? '/api/v1' : 'http://localhost:5002/api/v1');

export const userApi = axios.create({
  baseURL: USER_SERVICE_URL,
});

export const chatApi = axios.create({
  baseURL: CHAT_SERVICE_URL,
});

// Interceptor to attach the auth token to all requests
const authInterceptor = (config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('aether_chat_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

userApi.interceptors.request.use(authInterceptor, (err) => Promise.reject(err));
chatApi.interceptors.request.use(authInterceptor, (err) => Promise.reject(err));

export const getAvatarUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  if (url.startsWith('/uploads')) {
    if (isProduction) return url;
    const userBaseUrl = import.meta.env.VITE_USER_SERVICE_URL
      ? import.meta.env.VITE_USER_SERVICE_URL.replace('/api/v1', '')
      : 'http://localhost:5000';
    return `${userBaseUrl}${url}`;
  }
  return `https://res.cloudinary.com/dzssijacq/image/upload/${url}`;
};

export const getMediaUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  if (url.startsWith('/uploads')) {
    if (isProduction) return url;
    const chatBaseUrl = import.meta.env.VITE_CHAT_SERVICE_URL
      ? import.meta.env.VITE_CHAT_SERVICE_URL.replace('/api/v1', '')
      : 'http://localhost:5002';
    return `${chatBaseUrl}${url}`;
  }
  return `https://res.cloudinary.com/dzssijacq/image/upload/${url}`;
};

