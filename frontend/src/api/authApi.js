import apiClient from './axios';

export const login = (email, password) =>
  apiClient.post('/auth-service/login', { email, password });

export const register = (name, email, password, role) =>
  apiClient.post('/auth-service/register', { name, email, password, role });

export const getMe = () =>
  apiClient.get('/auth-service/me');