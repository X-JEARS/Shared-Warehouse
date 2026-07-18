import request from '../utils/request';

// Auth API
export const authApi = {
  login: (data: { loginName: string; password: string }) =>
    request.post('/auth/login', data),
  register: (data: { loginName: string; password: string; nickname?: string; tel?: string }) =>
    request.post('/auth/register', data),
  getMe: () => request.get('/auth/me'),
};

// User API
export const userApi = {
  updateProfile: (data: { nickname?: string; avatar?: string; tel?: string }) =>
    request.put('/users/profile', data),
  updatePassword: (data: { currentPassword: string; newPassword: string }) =>
    request.put('/users/password', data),
  uploadAvatar: (formData: FormData) =>
    request.post('/upload/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  search: (keyword: string) =>
    request.get('/users/search', { params: { keyword } }),
};

// Room API
export const roomApi = {
  getAll: () => request.get('/rooms'),
  getById: (id: number) => request.get(`/rooms/${id}`),
  create: (data: { name: string; notice?: string }) =>
    request.post('/rooms', data),
  update: (id: number, data: { name?: string; notice?: string }) =>
    request.put(`/rooms/${id}`, data),
  join: (id: number, memberName?: string) =>
    request.post(`/rooms/${id}/join`, { memberName }),
  requestJoin: (id: number, memberName?: string) =>
    request.post(`/rooms/${id}/request-join`, { memberName }),
  getJoinRequestStatus: (id: number) =>
    request.get(`/rooms/${id}/join-request-status`),
  getJoinRequests: (id: number) =>
    request.get(`/rooms/${id}/join-requests`),
  approveJoinRequest: (roomId: number, requestId: number) =>
    request.post(`/rooms/${roomId}/join-requests/${requestId}/approve`),
  rejectJoinRequest: (roomId: number, requestId: number) =>
    request.post(`/rooms/${roomId}/join-requests/${requestId}/reject`),
  getMembers: (id: number) => request.get(`/rooms/${id}/members`),
  removeMember: (roomId: number, memberId: number) =>
    request.delete(`/rooms/${roomId}/members/${memberId}`),
  addAdmin: (roomId: number, userId: number) =>
    request.post(`/rooms/${roomId}/admins`, { userId }),
  removeAdmin: (roomId: number, userId: number) =>
    request.delete(`/rooms/${roomId}/admins/${userId}`),
  transferPrimaryAdmin: (roomId: number, targetUserId: number) =>
    request.post(`/rooms/${roomId}/transfer-admin`, { userId: targetUserId }),
};

// Box API
export const boxApi = {
  getByRoom: (roomId: number) => request.get(`/boxes/room/${roomId}`),
  getById: (id: number) => request.get(`/boxes/${id}`),
  create: (roomId: number, data: { name: string; qrcode: string; notice?: string }) =>
    request.post(`/boxes/room/${roomId}`, data),
  update: (id: number, data: { name?: string; notice?: string }) =>
    request.put(`/boxes/${id}`, data),
  delete: (id: number, data?: { targetBoxId?: number; toUserHand?: boolean }) =>
    request.delete(`/boxes/${id}`, { data }),
};

// Item API
export const itemApi = {
  getAll: (params?: { roomId?: number; boxId?: number; tagId?: number; search?: string }) =>
    request.get('/items', { params }),
  getInHand: () => request.get('/items/in-hand'),
  getInHandCount: () => request.get('/items/in-hand/count'),
  getMy: () => request.get('/items/my'),
  getById: (id: number, roomId?: number) =>
    request.get(`/items/${id}`, { params: { roomId } }),
  getByQrcode: (code: string) => request.get(`/items/qrcode/${code}`),
  create: (data: {
    qrcode: string;
    name: string;
    boxId: number;
    belongUserId?: number;
    belongBoxId?: number;
    notice?: string;
    image?: string;
  }) => request.post('/items', data),
  update: (id: number, data: { name?: string; notice?: string; image?: string }) =>
    request.put(`/items/${id}`, data),
  delete: (id: number) => request.delete(`/items/${id}`),
  getHistory: (id: number) => request.get(`/items/${id}/history`),
  getComments: (id: number) => request.get(`/items/${id}/comments`),
  addComment: (id: number, content: string) =>
    request.post(`/items/${id}/comments`, { content }),
  setTags: (itemId: number, roomId: number, tagIds: number[]) =>
    request.put(`/items/${itemId}/tags`, { roomId, tagIds }),
  setRemark: (itemId: number, roomId: number, remark: string) =>
    request.put(`/items/${itemId}/remark`, { roomId, remark }),
  changeBelongBox: (itemId: number, newBoxId: number) =>
    request.put(`/items/${itemId}/belong-box`, { newBoxId }),
  transfer: (itemId: number, targetUserId: number) =>
    request.post(`/items/${itemId}/transfer`, { targetUserId }),
  uploadImage: (itemId: number, formData: FormData) =>
    request.post(`/upload/items/${itemId}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// Scan API
export const scanApi = {
  scan: (qrcode: string) => request.post('/scan', { qrcode }),
  borrow: (itemId: number) => request.post('/scan/borrow', { itemId }),
  borrowBatch: (itemIds: number[]) => request.post('/scan/borrow-batch', { itemIds }),
  returnItem: (itemId: number, boxId: number) =>
    request.post('/scan/return', { itemId, boxId }),
  returnBatch: (items: Array<{ itemId: number; boxId: number }>) =>
    request.post('/scan/return-batch', { items }),
};

// Reservation API
export const reservationApi = {
  getAll: (status?: 'active' | 'past') =>
    request.get('/reservations', { params: { status } }),
  create: (data: { itemId: number; startTime: number; endTime: number; orderId?: number }) =>
    request.post('/reservations', data),
  cancel: (id: number) => request.delete(`/reservations/${id}`),
  getByItem: (itemId: number) => request.get(`/reservations/items/${itemId}`),
  createOrder: (data: { title?: string; items: Array<{ itemId: number; startTime: number; endTime: number }> }) =>
    request.post('/reservations/orders', data),
  getOrders: (status?: 'active' | 'past') =>
    request.get('/reservations/orders', { params: { status } }),
  getRoomOrders: (roomId: number, status?: 'active' | 'past') =>
    request.get(`/reservations/rooms/${roomId}/orders`, { params: { status } }),
  getRecentRoomOrders: (roomId: number) =>
    request.get(`/reservations/rooms/${roomId}/recent-orders`),
  getOrderDetail: (id: number) => request.get(`/reservations/orders/${id}`),
  cancelOrder: (id: number) => request.delete(`/reservations/orders/${id}`),
  updateOrderTitle: (id: number, title: string) =>
    request.put(`/reservations/orders/${id}/title`, { title }),
  extendOrder: (id: number, newEndTime: number) =>
    request.put(`/reservations/orders/${id}/extend`, { newEndTime }),
  checkConflicts: (data: { itemIds: number[]; startTime: number; endTime: number }) =>
    request.post('/reservations/check-conflicts', data),
};

// Tag API
export const tagApi = {
  getByRoom: (roomId: number) => request.get(`/reservations/rooms/${roomId}/tags`),
  create: (roomId: number, name: string) =>
    request.post(`/reservations/rooms/${roomId}/tags`, { name }),
  update: (id: number, name: string) =>
    request.put(`/reservations/tags/${id}`, { name }),
  delete: (id: number) => request.delete(`/reservations/tags/${id}`),
};

// Cart API
export const cartApi = {
  get: () => request.get('/cart'),
  add: (data: { itemId: number; roomId?: number; startTime?: number; endTime?: number }) =>
    request.post('/cart', data),
  remove: (itemId: number) => request.delete(`/cart/${itemId}`),
  checkout: (title?: string) => request.post('/cart/checkout', { title }),
  clear: () => request.delete('/cart'),
};

// Notification API
export const notificationApi = {
  getAll: (page?: number, pageSize?: number) =>
    request.get('/notifications', { params: { page, pageSize } }),
  getUnreadCount: () => request.get('/notifications/unread-count'),
  markAsRead: (id: number) => request.put(`/notifications/${id}/read`),
  markAllAsRead: () => request.put('/notifications/read-all'),
};
