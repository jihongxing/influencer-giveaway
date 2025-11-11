// pages/share-item/share-item.js
const apiService = require('../../services/api-cloud').default;

Page({
  data: {
    orderId: null,
    photos: [],
    textContent: '',
    uploading: false,
  },

  onLoad(options) {
    const orderId = options.order_id;
    if (orderId) {
      this.setData({ orderId: parseInt(orderId, 10) });
    } else {
      wx.showToast({
        title: '缺少订单ID',
        icon: 'none',
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  onChoosePhotos() {
    const maxCount = 9 - this.data.photos.length;
    if (maxCount <= 0) {
      wx.showToast({
        title: '最多选择9张图片',
        icon: 'none',
      });
      return;
    }

    wx.chooseImage({
      count: maxCount,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          photos: [...this.data.photos, ...res.tempFilePaths],
        });
      },
    });
  },

  onRemovePhoto(e) {
    const index = e.currentTarget.dataset.index;
    const photos = this.data.photos.filter((_, i) => i !== index);
    this.setData({ photos });
  },

  onTextInput(e) {
    const textContent = e.detail.value;
    if (textContent.length > 500) {
      wx.showToast({
        title: '最多500字',
        icon: 'none',
      });
      return;
    }
    this.setData({ textContent });
  },

  async uploadPhoto(filePath) {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${apiService.baseURL}/upload/image`,
        filePath,
        name: 'file',
        header: {
          Authorization: `Bearer ${wx.getStorageSync('session_token')}`,
        },
        success: (res) => {
          try {
            const data = JSON.parse(res.data);
            if (data.success) {
              resolve(data.data.url);
            } else {
              reject(new Error(data.error?.message || '上传失败'));
            }
          } catch (error) {
            reject(error);
          }
        },
        fail: reject,
      });
    });
  },

  async onSubmit() {
    if (this.data.photos.length === 0) {
      wx.showToast({
        title: '请至少选择一张图片',
        icon: 'none',
      });
      return;
    }

    if (this.data.uploading) {
      return;
    }

    this.setData({ uploading: true });

    try {
      wx.showLoading({
        title: '上传中...',
      });

      // Upload photos
      const photoUrls = await Promise.all(
        this.data.photos.map((photo) => this.uploadPhoto(photo))
      );

      // Create sharing post
      const response = await apiService.createSharingPost({
        order_id: this.data.orderId,
        photos: photoUrls,
        text_content: this.data.textContent || undefined,
      });

      wx.hideLoading();

      if (response.success) {
        wx.showToast({
          title: '分享成功',
          icon: 'success',
        });

        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        throw new Error(response.error?.message || '分享失败');
      }
    } catch (error) {
      wx.hideLoading();
      console.error('Share item error:', error);
      wx.showToast({
        title: error.message || '分享失败',
        icon: 'none',
      });
    } finally {
      this.setData({ uploading: false });
    }
  },
});
