import apiClient from './axios';

export const getAllocations = (params) =>
  apiClient.get('/allocations-service', { params });

export const getAllocation = (id) =>
  apiClient.get(`/allocations-service/${id}`);

export const createAllocation = (data) =>
  apiClient.post('/allocations-service', data);

export const updateAllocation = (id, data) =>
  apiClient.put(`/allocations-service/${id}`, data);

export const deleteAllocation = (id) =>
  apiClient.delete(`/allocations-service/${id}`);