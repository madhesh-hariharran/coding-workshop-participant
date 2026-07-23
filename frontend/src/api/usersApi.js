import apiClient from './axios';

export const getUsers = (params) =>
  apiClient.get('/users-service', { params });

export const getUser = (id) =>
  apiClient.get(`/users-service/${id}`);

export const updateUser = (id, data) =>
  apiClient.put(`/users-service/${id}`, data);

export const deleteUser = (id) =>
  apiClient.delete(`/users-service/${id}`);