import apiClient from './axios';

export const getProjects = (params) =>
  apiClient.get('/projects-service', { params });

export const getProject = (id) =>
  apiClient.get(`/projects-service/${id}`);

export const createProject = (data) =>
  apiClient.post('/projects-service', data);

export const updateProject = (id, data) =>
  apiClient.put(`/projects-service/${id}`, data);

export const deleteProject = (id) =>
  apiClient.delete(`/projects-service/${id}`);