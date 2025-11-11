// pages/order-detail/order-detail.js
const apiService = require('../../services/api-cloud').default;

Page({
  data: {
    orderId: null,
    order: null,
    item: null,
    shippingInfo: null,
    loading: true,
    error: '',
    isOwner: false, // 是否是订单创建者（领取者）
  },

  onLoad(options) {
    const orderId = options.id ? parseInt(options.id, 10) : null;
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

  onShow() {
    // 每次显示时刷新数据
    if (this.data.orderId) {
      this.loadOrderData();
    }
  },

  onPullDownRefresh() {
    this.loadOrderData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadOrderData() {
    this.setData({ loading: true, error: '' });

    try {
      const response = await apiService.getOrderDetail(this.data.orderId);

      if (response.success && response.data) {
        const order = response.data;
        const item = order.item || null;
        const shippingInfo = order.shipping_info || null;

        // 检查是否是订单创建者
        const sessionToken = wx.getStorageSync('sessionToken');
        let isOwner = false;
        if (sessionToken) {
          try {
            const userResponse = await apiService.getUserInfo();
            if (userResponse.success && userResponse.data) {
              // 比较用户ID和订单的fan_wechat_openid
              // 注意：这里需要根据实际API返回的数据结构来判断
              isOwner = userResponse.data.wechat_openid === order.fan_wechat_openid;
            }
          } catch (error) {
            // 忽略错误
          }
        }

        this.setData({
          order,
          item,
          shippingInfo,
          isOwner,
          loading: false,
        });
      } else {
        throw new Error(response.error?.message || '加载订单失败');
      }
    } catch (error) {
      console.error('Load order error:', error);
      this.setData({
        loading: false,
        error: error.message || '加载失败，请重试',
      });
    }
  },

  onViewShippingLabel() {
    if (this.data.shippingInfo && this.data.shippingInfo.shipping_label_url) {
      wx.navigateTo({
        url: `/pages/shipping-label/shipping-label?url=${encodeURIComponent(this.data.shippingInfo.shipping_label_url)}`,
      });
    } else {
      wx.showToast({
        title: '物流标签未生成',
        icon: 'none',
      });
    }
  },

  onConfirmReceipt() {
    wx.showModal({
      title: '确认收货',
      content: '确认已收到物品吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            // TODO: 实现确认收货API
            wx.showToast({
              title: '确认收货功能开发中',
              icon: 'none',
            });
          } catch (error) {
            wx.showToast({
              title: error.message || '操作失败',
              icon: 'none',
            });
          }
        }
      },
    });
  },

  onContactService() {
    // TODO: 实现联系客服功能
    wx.showToast({
      title: '客服功能开发中',
      icon: 'none',
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

  getPaymentStatusText(status) {
    const statusMap = {
      pending: '待支付',
      paid: '已支付',
      failed: '支付失败',
      refunded: '已退款',
    };
    return statusMap[status] || status;
  },
});

