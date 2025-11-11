// pages/batch-upload-items/batch-upload-items.js
Page({
  data: {
    activity_id: '',
    activity_title: '',
    
    // 物品列表
    items: [], // { temp_id, photo_urls, quantity, ai_category, ai_tags, label, shipping_cost_estimate, categoryIndex }
    
    // 类别选项
    categoryOptions: [
      { value: 'shoes', label: '👟 鞋类' },
      { value: 'clothing', label: '👔 衣物' },
      { value: 'electronics', label: '📱 电子产品' },
      { value: 'books', label: '📚 书籍' },
      { value: 'cosmetics', label: '💄 美妆' },
      { value: 'toys', label: '🧸 玩具' },
      { value: 'bags', label: '🎒 包包' },
      { value: 'food', label: '🍭 食品' },
      { value: 'stationery', label: '✏️ 文具' },
      { value: 'home', label: '🏠 家居' },
      { value: 'other', label: '📦 其他' }
    ],
    
    // 批量设置
    marker_prefix: 'ITEM',
    
    // UI状态
    uploading: false,
    processing: false,
    publishing: false
  },

  onLoad(options) {
    const { activity_id } = options;
    if (!activity_id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    this.setData({ activity_id });
    
    // 获取活动信息
    this.getActivityInfo();
  },

  // 获取活动信息
  getActivityInfo() {
    wx.cloud.callFunction({
      name: 'activities',
      data: {
        action: 'getDetail',
        data: { activity_id: this.data.activity_id }
      }
    }).then(res => {
      if (res.result.success) {
        const activityData = res.result.data;
        this.setData({
          activity_title: activityData.title || activityData.activity_id // 使用title字段，回退到ID
        });
      }
    }).catch(err => {
      console.error('获取活动信息失败:', err);
      // 即使失败也显示ID
      this.setData({
        activity_title: this.data.activity_id
      });
    });
  },

  // 选择照片
  onChoosePhotos() {
    wx.chooseImage({
      count: 9,  // 每次最多9张，避免超时
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.uploadPhotos(res.tempFilePaths);
      }
    });
  },

  // 上传照片
  uploadPhotos(tempFilePaths) {
    this.setData({ uploading: true });
    
    const uploadPromises = tempFilePaths.map(filePath => {
      const cloudPath = `items/${Date.now()}-${Math.random().toString(36).substr(2)}.jpg`;
      return wx.cloud.uploadFile({
        cloudPath,
        filePath
      });
    });

    Promise.all(uploadPromises)
      .then(results => {
        const fileIDs = results.map(r => r.fileID);
        
        // 获取临时访问链接
        return wx.cloud.getTempFileURL({
          fileList: fileIDs
        }).then(tempRes => {
          console.log('临时链接:', tempRes);
          
          // 使用临时链接进行处理
          const tempURLs = tempRes.fileList.map(file => file.tempFileURL);
          return this.processPhotos(fileIDs, tempURLs);
        });
      })
      .catch(err => {
        console.error('上传失败:', err);
        wx.showToast({ title: '上传失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ uploading: false });
      });
  },

  // 处理照片（AI识别）
  processPhotos(fileIDs, tempURLs) {
    this.setData({ processing: true });

    wx.cloud.callFunction({
      name: 'items',
      data: {
        action: 'processPhotos',
        data: { 
          files: fileIDs,
          start_index: this.data.items.length // 传入当前已有物品数量作为起始编号
        }
      },
      timeout: 30000  // 设置30秒超时
    }).then(res => {
      this.setData({ processing: false });

      if (res.result.success) {
        const newItems = res.result.data.items.map((item, index) => {
          // 找到对应的类别索引
          const categoryIndex = this.data.categoryOptions.findIndex(opt => opt.value === item.ai_category);
          
          return {
            ...item,
            photo_urls: [tempURLs[index] || item.photo_urls[0]], // 使用临时链接
            quantity: 1,
            label: item.suggested_label || '',
            ai_tags: item.ai_tags || [],
            categoryIndex: categoryIndex >= 0 ? categoryIndex : this.data.categoryOptions.length - 1 // 默认为“其他”
          };
        });

        this.setData({
          items: [...this.data.items, ...newItems]
        });

        wx.showToast({ title: `识别完成，共${newItems.length}件物品`, icon: 'success' });
      } else {
        wx.showToast({ 
          title: res.result.error?.message || '识别失败', 
          icon: 'none',
          duration: 3000
        });
      }
    }).catch(err => {
      this.setData({ processing: false });
      console.error('处理失败:', err);
      
      // 更好的错误提示
      let errorMsg = '处理失败，请重试';
      if (err.errMsg && err.errMsg.includes('timeout')) {
        errorMsg = '处理超时，请减少图片数量后重试';
      } else if (err.errMsg && err.errMsg.includes('TIME_LIMIT')) {
        errorMsg = '处理时间过长，请一次最多上传3张图片';
      }
      
      wx.showToast({ 
        title: errorMsg, 
        icon: 'none',
        duration: 3000
      });
    });
  },

  // 数量输入
  onQuantityInput(e) {
    const index = e.currentTarget.dataset.index;
    let value = e.detail.value;
    
    // 允许空字符串，用户可能在删除输入
    if (value === '') {
      this.setData({
        [`items[${index}].quantity`]: ''
      });
      return;
    }
    
    // 转换为整数
    value = parseInt(value);
    
    // 如果不是有效数字，保持原值
    if (isNaN(value)) {
      return;
    }
    
    // 限制范围 1-100
    value = Math.max(1, Math.min(100, value));
    
    this.setData({
      [`items[${index}].quantity`]: value
    });
  },

  // 数量失去焦点时验证
  onQuantityBlur(e) {
    const index = e.currentTarget.dataset.index;
    const value = parseInt(e.detail.value);
    
    // 如果为空或无效，设置为1
    if (!value || isNaN(value) || value < 1) {
      this.setData({
        [`items[${index}].quantity`]: 1
      });
      wx.showToast({
        title: '数量至少为1件',
        icon: 'none',
        duration: 1500
      });
    }
  },

  // 数量增减按钮
  onQuantityChange(e) {
    const index = e.currentTarget.dataset.index;
    const action = e.currentTarget.dataset.action;
    const currentQuantity = parseInt(this.data.items[index].quantity) || 1;
    
    let newQuantity = currentQuantity;
    
    if (action === 'increase') {
      newQuantity = Math.min(100, currentQuantity + 1);
    } else if (action === 'decrease') {
      newQuantity = Math.max(1, currentQuantity - 1);
    }
    
    this.setData({
      [`items[${index}].quantity`]: newQuantity
    });
    
    // 达到极限时提示
    if (newQuantity === 100 && action === 'increase') {
      wx.showToast({
        title: '最多100件',
        icon: 'none',
        duration: 1000
      });
    }
  },

  // 类别选择
  onCategoryChange(e) {
    const index = e.currentTarget.dataset.index;
    const categoryIndex = parseInt(e.detail.value);
    const selectedCategory = this.data.categoryOptions[categoryIndex];
    
    this.setData({
      [`items[${index}].categoryIndex`]: categoryIndex,
      [`items[${index}].ai_category`]: selectedCategory.value
    });
    
    console.log(`物品${index + 1}类别更改为:`, selectedCategory.label);
  },

  // 标签输入
  onLabelInput(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      [`items[${index}].label`]: e.detail.value
    });
  },

  // 删除物品
  onDeleteItem(e) {
    const index = e.currentTarget.dataset.index;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个物品吗？',
      success: (res) => {
        if (res.confirm) {
          const items = this.data.items;
          items.splice(index, 1);
          this.setData({ items });
        }
      }
    });
  },

  // 标记前缀输入
  onMarkerPrefixInput(e) {
    this.setData({
      marker_prefix: e.detail.value || 'ITEM'
    });
  },

  // 完成并发布
  onPublish() {
    if (this.data.items.length === 0) {
      wx.showToast({ title: '请至少添加一个物品', icon: 'none' });
      return;
    }

    // 计算总数量
    const totalQuantity = this.data.items.reduce((sum, item) => sum + item.quantity, 0);
    if (totalQuantity > 100) {
      wx.showToast({ title: '物品总数不能超过100件', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认发布',
      content: `将批量创建 ${totalQuantity} 件物品，确认继续吗？`,
      success: (res) => {
        if (res.confirm) {
          this.batchUploadItems();
        }
      }
    });
  },

  // 批量上传物品
  batchUploadItems() {
    const { activity_id, items, marker_prefix } = this.data;
    
    // 再次检查activity_id
    if (!activity_id) {
      wx.showToast({ title: '缺少活动ID，请重新创建', icon: 'none' });
      return;
    }

    this.setData({ publishing: true });

    const items_data = items.map(item => ({
      photo_urls: item.photo_urls,
      quantity: item.quantity,
      ai_category: item.ai_category,
      ai_tags: item.ai_tags || [],
      shipping_cost_estimate: item.shipping_cost_estimate,
      label: item.label
    }));

    console.log('开始上传物品, activity_id:', activity_id);
    console.log('物品数据:', JSON.stringify(items_data));

    wx.cloud.callFunction({
      name: 'items',
      data: {
        action: 'batchUpload',
        data: {
          activity_id: activity_id,
          items_data,
          marker_prefix: marker_prefix
        }
      }
    }).then(res => {
      console.log('物品上传结果:', res);
      
      if (res.result.success) {
        // 发布活动
        return this.publishActivity();
      } else {
        throw new Error(res.result.error.message || '上传物品失败');
      }
    }).then(publishRes => {
      console.log('活动发布结果:', publishRes);
      
      this.setData({ publishing: false });

      if (publishRes.result.success) {
        wx.showToast({ title: '发布成功', icon: 'success' });
        
        setTimeout(() => {
          // 使用reLaunch替代redirectTo，确保能跳转
          // 使用activity_id参数，详情页面已支持多种参数格式
          wx.reLaunch({
            url: `/pages/activity-detail/activity-detail?activity_id=${activity_id}`
          });
        }, 1500);
      } else {
        throw new Error(publishRes.result.error.message || '发布活动失败');
      }
    }).catch(err => {
      this.setData({ publishing: false });
      console.error('发布失败:', err);
      wx.showToast({ 
        title: err.message || '发布失败', 
        icon: 'none',
        duration: 3000
      });
    });
  },

  // 发布活动
  publishActivity() {
    return wx.cloud.callFunction({
      name: 'activities',
      data: {
        action: 'publish',
        data: { activity_id: this.data.activity_id }
      }
    });
  },

  // 返回
  onBack() {
    wx.showModal({
      title: '提示',
      content: '返回将丢失当前添加的物品，确定要返回吗？',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack();
        }
      }
    });
  }
});
