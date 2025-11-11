// pages/shipping-label/shipping-label.js
const apiService = require('../../services/api-cloud').default;

Page({
  data: {
    orderId: null,
    shippingLabelUrl: null,
    trackingNumber: null,
    loading: true,
  },

  onLoad(options) {
    const orderId = parseInt(options.order_id, 10);
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
    this.loadShippingLabel();
  },

  async loadShippingLabel() {
    this.setData({ loading: true });

    try {
      const response = await apiService.getOrderDetail(this.data.orderId);

      if (response.success && response.data) {
        const shippingInfo = response.data.shipping_info;
        if (shippingInfo && shippingInfo.shipping_label_url) {
          this.setData({
            shippingLabelUrl: shippingInfo.shipping_label_url,
            trackingNumber: shippingInfo.tracking_number,
            loading: false,
          });
        } else {
          throw new Error('物流标签尚未生成');
        }
      } else {
        throw new Error(response.error?.message || '加载失败');
      }
    } catch (error) {
      console.error('Load shipping label error:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none',
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  onPreviewImage() {
    if (this.data.shippingLabelUrl) {
      wx.previewImage({
        urls: [this.data.shippingLabelUrl],
        current: this.data.shippingLabelUrl,
      });
    }
  },

  onCopyTrackingNumber() {
    if (this.data.trackingNumber) {
      wx.setClipboardData({
        data: this.data.trackingNumber,
        success: () => {
          wx.showToast({
            title: '运单号已复制',
            icon: 'success',
          });
        },
      });
    }
  },
});

