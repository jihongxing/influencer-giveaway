// pages/my-activities/my-activities.js
const apiService = require('../../services/api-cloud').default;

Page({
  data: {
    activities: [],
    loading: false,
  },

  onLoad() {
    this.loadActivities();
  },

  onShow() {
    this.loadActivities();
  },

  async loadActivities() {
    this.setData({ loading: true });

    try {
      const response = await apiService.getActivities();

      if (response.success) {
        this.setData({
          activities: response.data,
          loading: false,
        });
      } else {
        throw new Error(response.error?.message || '加载失败');
      }
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none',
      });
    }
  },

  onActivityTap(e) {
    const activityId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/activity-detail/activity-detail?id=${activityId}`,
    });
  },

  onCreateActivity() {
    wx.navigateTo({
      url: '/pages/create-giveaway/create-giveaway',
    });
  },

  onScanQRCode() {
    wx.scanCode({
      onlyFromCamera: true,
      scanType: ['qrCode'],
      success: async (res) => {
        wx.showLoading({
          title: '匹配中...',
        });

        try {
          const response = await apiService.scanMatchOrder(res.result);

          if (response.success && response.data) {
            wx.hideLoading();
            wx.showModal({
              title: '匹配成功',
              content: `订单号: #${response.data.order_id}\n物品标记: ${response.data.item_marker_name}`,
              showCancel: false,
              success: () => {
                // Navigate to order detail or shipping label
                if (response.data.shipping_label_url) {
                  wx.navigateTo({
                    url: `/pages/shipping-label/shipping-label?order_id=${response.data.order_id}`,
                  });
                }
              },
            });
          } else {
            throw new Error(response.error?.message || '匹配失败');
          }
        } catch (error) {
          wx.hideLoading();
          wx.showToast({
            title: error.message || '匹配失败',
            icon: 'none',
          });
        }
      },
      fail: (err) => {
        if (err.errMsg && !err.errMsg.includes('cancel')) {
          wx.showToast({
            title: '扫描失败',
            icon: 'none',
          });
        }
      },
    });
  },
});


