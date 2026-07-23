import apiClient from './axios';

export const getDeliverables = (params) =>
  apiClient.get('/deliverables-service', { params });

export const getDeliverable = (id) =>
  apiClient.get(`/deliverables-service/${id}`);

export const createDeliverable = (data) =>
  apiClient.post('/deliverables-service', data);

export const updateDeliverable = (id, data) =>
  apiClient.put(`/deliverables-service/${id}`, data);

export const deleteDeliverable = (id) =>
  apiClient.delete(`/deliverables-service/${id}`);