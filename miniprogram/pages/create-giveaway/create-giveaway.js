// pages/create-giveaway/create-giveaway.js
const apiService = require('../../services/api-cloud').default;
const imageUtils = require('../../utils/imageUtils').default;

Page({
  data: {
    uploadedPhotos: [],
    processedItems: [],
    activityId: null,
    currentStep: 1, // 1: upload, 2: process, 3: edit
    selectedItems: [], // 选中的物品索引
    batchMode: false, // 是否处于批量编辑模式
  },

  onLoad(options) {
    if (options.activityId) {
      this.setData({
        activityId: parseInt(options.activityId, 10),
      });
      this.loadActivity();
    }
  },

  // Upload photos
  async onChoosePhotos() {
    wx.chooseImage({
      count: 20, // 增加最大数量
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        wx.showLoading({
          title: '上传中...',
        });

        try {
          // Compress images before upload
          const compressedFiles = await Promise.all(
            res.tempFilePaths.map((path) => imageUtils.compressImage(path))
          );

          // 上传到云存储
          const uploadPromises = compressedFiles.map((filePath, index) =>
            new Promise((resolve, reject) => {
              const fileName = `items/${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}.jpg`;
              wx.cloud.uploadFile({
                cloudPath: fileName,
                filePath,
                success: (res) => {
                  // 返回云存储的fileID
                  resolve(res.fileID);
                },
                fail: (err) => {
                  console.error('Upload to cloud storage error:', err);
                  reject(new Error(err.errMsg || '上传失败'));
                }
              });
            })
          );

          const tempItemIds = await Promise.all(uploadPromises);
          const allTempIds = tempItemIds.flat();

          this.setData({
            uploadedPhotos: [...this.data.uploadedPhotos, ...res.tempFilePaths],
            tempItemIds: [...(this.data.tempItemIds || []), ...allTempIds],
          });

          wx.hideLoading();
          wx.showToast({
            title: '上传成功',
            icon: 'success',
          });
        } catch (error) {
          wx.hideLoading();
          wx.showToast({
            title: error.message || '上传失败',
            icon: 'none',
          });
        }
      },
    });
  },

  // Process items with AI
  async onProcessItems() {
    if (!this.data.tempItemIds || this.data.tempItemIds.length === 0) {
      wx.showToast({
        title: '请先上传照片',
        icon: 'none',
      });
      return;
    }

    wx.showLoading({
      title: 'AI识别中...',
    });

    try {
      // 使用云函数处理物品照片
      // tempItemIds 现在存储的是云存储的 fileID 数组
      const response = await apiService.processItems(this.data.tempItemIds);

      if (response.success) {
        // 为每个物品设置默认数量为1
        const items = response.data.items.map((item) => ({
          ...item,
          quantity: 1, // 默认数量
        }));

        this.setData({
          processedItems: items,
          currentStep: 3,
        });

        wx.hideLoading();
        wx.showToast({
          title: '识别成功',
          icon: 'success',
        });
      } else {
        throw new Error(response.error?.message || '处理失败');
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: error.message || '处理失败',
        icon: 'none',
      });
    }
  },

  // Toggle batch mode
  onToggleBatchMode() {
    this.setData({
      batchMode: !this.data.batchMode,
      selectedItems: [],
    });
  },

  // Select/deselect item
  onToggleItemSelect(e) {
    const index = e.currentTarget.dataset.index;
    const selectedItems = [...this.data.selectedItems];
    const itemIndex = selectedItems.indexOf(index);

    if (itemIndex > -1) {
      selectedItems.splice(itemIndex, 1);
    } else {
      selectedItems.push(index);
    }

    this.setData({ selectedItems });
  },

  // Batch edit quantity
  onBatchEditQuantity() {
    if (this.data.selectedItems.length === 0) {
      wx.showToast({
        title: '请先选择物品',
        icon: 'none',
      });
      return;
    }

    wx.showModal({
      title: '批量设置数量',
      editable: true,
      placeholderText: '请输入数量',
      success: (res) => {
        if (res.confirm && res.content) {
          const quantity = parseInt(res.content, 10);
          if (isNaN(quantity) || quantity < 1) {
            wx.showToast({
              title: '请输入有效数量',
              icon: 'none',
            });
            return;
          }

          const processedItems = [...this.data.processedItems];
          this.data.selectedItems.forEach((index) => {
            processedItems[index].quantity = quantity;
          });

          this.setData({
            processedItems,
            selectedItems: [],
            batchMode: false,
          });

          wx.showToast({
            title: '设置成功',
            icon: 'success',
          });
        }
      },
    });
  },

  // Batch edit shipping cost
  onBatchEditShipping() {
    if (this.data.selectedItems.length === 0) {
      wx.showToast({
        title: '请先选择物品',
        icon: 'none',
      });
      return;
    }

    wx.showModal({
      title: '批量设置运费',
      editable: true,
      placeholderText: '请输入运费（元）',
      success: (res) => {
        if (res.confirm && res.content) {
          const shippingCost = parseFloat(res.content);
          if (isNaN(shippingCost) || shippingCost < 0) {
            wx.showToast({
              title: '请输入有效运费',
              icon: 'none',
            });
            return;
          }

          const processedItems = [...this.data.processedItems];
          this.data.selectedItems.forEach((index) => {
            processedItems[index].shipping_cost_estimate = shippingCost;
          });

          this.setData({
            processedItems,
            selectedItems: [],
            batchMode: false,
          });

          wx.showToast({
            title: '设置成功',
            icon: 'success',
          });
        }
      },
    });
  },

  // Edit single item
  onEditItem(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.processedItems[index];
    
    // 直接在当前页面编辑
    wx.showModal({
      title: '编辑物品',
      content: `物品名称：${item.suggested_label || '未命名'}\n分类：${item.ai_category || '其他'}\n数量：${item.quantity || 1}\n运费：¥${item.shipping_cost_estimate || 0}`,
      editable: true,
      placeholderText: '请输入新名称',
      success: (res) => {
        if (res.confirm) {
          const processedItems = [...this.data.processedItems];
          if (res.content) {
            processedItems[index].suggested_label = res.content;
          }
          this.setData({ processedItems });
        }
      },
    });
  },

  // Edit item quantity
  onEditQuantity(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.processedItems[index];
    
    wx.showModal({
      title: '设置数量',
      editable: true,
      placeholderText: `当前数量：${item.quantity || 1}`,
      success: (res) => {
        if (res.confirm && res.content) {
          const quantity = parseInt(res.content, 10);
          if (isNaN(quantity) || quantity < 1) {
            wx.showToast({
              title: '请输入有效数量',
              icon: 'none',
            });
            return;
          }

          const processedItems = [...this.data.processedItems];
          processedItems[index].quantity = quantity;
          this.setData({ processedItems });

          wx.showToast({
            title: '设置成功',
            icon: 'success',
          });
        }
      },
    });
  },

  // Delete item
  onDeleteItem(e) {
    const index = e.currentTarget.dataset.index;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个物品吗？',
      success: (res) => {
        if (res.confirm) {
          const processedItems = [...this.data.processedItems];
          processedItems.splice(index, 1);
          this.setData({ processedItems });

          wx.showToast({
            title: '已删除',
            icon: 'success',
          });
        }
      },
    });
  },

  // Delete selected items
  onDeleteSelected() {
    if (this.data.selectedItems.length === 0) {
      wx.showToast({
        title: '请先选择物品',
        icon: 'none',
      });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: `确定要删除选中的 ${this.data.selectedItems.length} 个物品吗？`,
      success: (res) => {
        if (res.confirm) {
          const processedItems = [...this.data.processedItems];
          // 从后往前删除，避免索引变化
          const sortedIndices = [...this.data.selectedItems].sort((a, b) => b - a);
          sortedIndices.forEach((index) => {
            processedItems.splice(index, 1);
          });

          this.setData({
            processedItems,
            selectedItems: [],
            batchMode: false,
          });

          wx.showToast({
            title: '已删除',
            icon: 'success',
          });
        }
      },
    });
  },

  // Create or update activity
  async onSubmit() {
    if (this.data.processedItems.length === 0) {
      wx.showToast({
        title: '请至少添加一个物品',
        icon: 'none',
      });
      return;
    }

    // 验证所有物品都有数量
    const invalidItems = this.data.processedItems.filter(
      (item) => !item.quantity || item.quantity < 1
    );
    if (invalidItems.length > 0) {
      wx.showToast({
        title: '请为所有物品设置数量',
        icon: 'none',
      });
      return;
    }

    wx.showLoading({
      title: '保存中...',
    });

    try {
      // 展开物品：如果数量>1，创建多个物品记录
      const items = [];
      this.data.processedItems.forEach((item) => {
        for (let i = 0; i < (item.quantity || 1); i++) {
          items.push({
            temp_id: item.temp_id,
            photo_urls: item.photo_urls,
            category: item.ai_category,
            label: item.suggested_label,
            marker_name: item.marker_name || '',
            quantity: 1, // 每个物品记录数量为1
            shipping_cost_estimate: item.shipping_cost_estimate,
          });
        }
      });

      let response;
      if (this.data.activityId) {
        // Update existing activity
        response = await apiService.updateActivity(this.data.activityId, {
          items,
        });
      } else {
        // Create new activity
        response = await apiService.createActivity({
          items,
        });
      }

      if (response.success) {
        wx.hideLoading();
        wx.showToast({
          title: '保存成功',
          icon: 'success',
        });

        setTimeout(() => {
          // 跳转到活动详情页
          const activityId = response.data.activity_id || this.data.activityId;
          if (activityId) {
            wx.redirectTo({
              url: `/pages/activity-detail/activity-detail?id=${activityId}`,
            });
          } else {
            wx.switchTab({
              url: '/pages/profile/profile',
            });
          }
        }, 1500);
      } else {
        throw new Error(response.error?.message || '保存失败');
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none',
      });
    }
  },
});
