// pages/my-orders/my-orders.js
const apiService = require('../../services/api-cloud').default;

Page({
  data: {
    orders: [],
    loading: true,
    page: 1,
    limit: 20,
    hasMore: true,
    status: '', // Filter by status
  },

  onLoad() {
    this.loadOrders();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, orders: [], hasMore: true });
    this.loadOrders().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadOrders();
    }
  },

  async loadOrders() {
    if (this.data.loading && this.data.page > 1) {
      return; // Already loading
    }

    this.setData({ loading: true });

    try {
      const params = {
        page: this.data.page,
        limit: this.data.limit,
      };
      if (this.data.status) {
        params.status = this.data.status;
      }

      const response = await apiService.getOrders(params);

      if (response.success && response.data) {
        const newOrders = (response.data.orders || []).map((order) => ({
          ...order,
          statusText: this.getStatusText(order.order_status),
        }));
        const allOrders = this.data.page === 1 ? newOrders : [...this.data.orders, ...newOrders];
        const hasMore = allOrders.length < response.data.pagination.total;

        this.setData({
          orders: allOrders,
          hasMore,
          loading: false,
        });
      } else {
        throw new Error(response.error?.message || '加载订单失败');
      }
    } catch (error) {
      console.error('Load orders error:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none',
      });
    }
  },

  onStatusFilter(e) {
    const status = e.currentTarget.dataset.status || '';
    this.setData({
      status,
      page: 1,
      orders: [],
      hasMore: true,
    });
    this.loadOrders();
  },

  onOrderTap(e) {
    const orderId = e.currentTarget.dataset.orderId;
    wx.navigateTo({
      url: `/pages/order-detail/order-detail?id=${orderId}`,
    });
  },

  getStatusText(status) {
    const statusMap = {
      pending: '待处理',
      processing: '处理中',
      shipped: '已发货',
      delivered: '已送达',
      completed: '已完成',
      cancelled: '已取消',
    };
    return statusMap[status] || status;
  },
});

