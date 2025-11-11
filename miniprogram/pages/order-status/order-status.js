// pages/order-status/order-status.js
const apiService = require('../../services/api-cloud').default;

Page({
  data: {
    orderId: null,
    order: null,
    item: null,
    shippingInfo: null,
    orderStatusText: '',
    paymentStatusText: '',
    loading: true,
  },

  onLoad(options) {
    const orderId = options.order_id;  // 保持字符串格式（MongoDB ObjectId）
    
    console.log('[Order Status] onLoad 参数:', { orderId });
    
    if (!orderId) {
      wx.showToast({
        title: '缺少订单ID',
        icon: 'none',
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    this.setData({ orderId });
    this.loadOrderData();
  },

  onPullDownRefresh() {
    this.loadOrderData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadOrderData() {
    this.setData({ loading: true });

    try {
      const response = await apiService.getOrderDetail(this.data.orderId);

      if (response.success && response.data) {
        const order = response.data;
        this.setData({
          order: order,
          item: order.item,
          shippingInfo: order.shipping_info || null,
          orderStatusText: this.getStatusText(order.order_status),
          paymentStatusText: this.getPaymentStatusText(order.payment_status),
          loading: false,
        });
      } else {
        throw new Error(response.error?.message || '加载订单失败');
      }
    } catch (error) {
      console.error('Load order error:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none',
      });
    }
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

  getPaymentStatusText(status) {
    const statusMap = {
      pending: '待支付',
      paid: '已支付',
      failed: '支付失败',
      refunded: '已退款',
    };
    return statusMap[status] || status;
  },

  onViewShippingLabel(e) {
    const orderId = e.currentTarget.dataset.orderId;
    wx.navigateTo({
      url: `/pages/shipping-label/shipping-label?order_id=${orderId}`,
    });
  },
});

