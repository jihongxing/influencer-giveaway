// pages/giveaway/giveaway.js
const apiService = require('../../services/api-cloud').default;

Page({
  data: {
    activityId: null,
    influencer: {
      nickname: '',
      avatar_url: '',
    },
    items: [],
    loading: true,
    error: '',
    shareableLink: '',
  },

  onLoad(options) {
    const linkId = options.link_id || options.id;
    if (linkId) {
      this.setData({ shareableLink: linkId });
      this.loadGiveawayData(linkId);
    } else {
      wx.showToast({
        title: '缺少活动链接',
        icon: 'none',
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  async loadGiveawayData(linkId) {
    if (!linkId) {
      linkId = this.data.shareableLink;
    }
    
    this.setData({ loading: true, error: '' });

    try {
      const response = await apiService.getPublicActivityDetail(linkId);

      if (response.success && response.data) {
        this.setData({
          activityId: response.data.activity_id,
          influencer: response.data.influencer,
          items: response.data.items || [],
          loading: false,
          error: '',
        });
      } else {
        throw new Error(response.error?.message || '加载活动失败');
      }
    } catch (error) {
      console.error('Load giveaway error:', error);
      this.setData({
        loading: false,
        error: error.message || '加载失败，请重试',
      });
    }
  },

  onItemTap(e) {
    const itemId = e.currentTarget.dataset.itemId;
    const item = this.data.items.find((i) => i.item_id === itemId);

    if (!item) {
      return;
    }

    if (item.status !== 'available') {
      wx.showToast({
        title: '该物品已被领取',
        icon: 'none',
      });
      return;
    }

    // Navigate to claim item page
    wx.navigateTo({
      url: `/pages/claim-item/claim-item?item_id=${itemId}&activity_id=${this.data.activityId}`,
    });
  },

  onShareAppMessage() {
    return {
      title: `${this.data.influencer.nickname}的赠送活动`,
      path: `/pages/giveaway/giveaway?link_id=${this.data.shareableLink}`,
    };
  },
});

