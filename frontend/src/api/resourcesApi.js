import apiClient from './axios';

export const getResources = (params) =>
  apiClient.get('/resources-service', { params });

export const getResource = (id) =>
  apiClient.get(`/resources-service/${id}`);

export const getEligibleUsers = () =>
  apiClient.get('/resources-service/eligible-users');

export const createResource = (data) =>
  apiClient.post('/resources-service', data);

export const updateResource = (id, data) =>
  apiClient.put(`/resources-service/${id}`, data);

export const deleteResource = (id) =>
  apiClient.delete(`/resources-service/${id}`);