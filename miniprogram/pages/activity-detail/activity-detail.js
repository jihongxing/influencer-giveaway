// pages/activity-detail/activity-detail.js
const apiService = require('../../services/api-cloud').default;

// 引入图片错误处理工具
const { handleImageError, batchHandleImageErrors } = require('../../utils/image-error-handler');

Page({
  data: {
    activityId: null,
    linkId: null,
    activity: null,
    items: [],
    orders: [],
    isOwner: false,
    loading: true,
    error: '',
    showShareModal: false,
    claimedItemsCount: 0, // 已领取物品数量
    retryCount: 0,  // 重试次数
    maxRetries: 3,  // 最大重试次数
    // 密码验证相关
    showPasswordModal: false,
    inputPassword: '',
    passwordError: '',
    passwordHint: '',
    isPasswordVerified: false,
  },

  onLoad(options) {
    // 统一支持多种参数格式：activity_id, id, link_id
    // 优先级：activity_id > id > link_id
    let activityId = null;
    
    // 1. 先尝试 activity_id（从创建流程来的）
    if (options.activity_id) {
      activityId = options.activity_id;  // 直接使用字符串，不要 parseInt
    }
    // 2. 其次尝试 id（从列表页来的）
    else if (options.id) {
      activityId = options.id;
    }
    
    const linkId = options.link_id;

    console.log('活动详情页面加载参数:', { 
      activity_id: options.activity_id, 
      id: options.id, 
      link_id: options.link_id,
      resolved_activityId: activityId,
      resolved_linkId: linkId,
      activityId_type: typeof activityId
    });

    if (!activityId && !linkId) {
      console.error('缺少活动ID或链接ID');
      wx.showToast({
        title: '缺少活动ID',
        icon: 'none',
      });
      setTimeout(() => {
        wx.navigateBack({
          fail: () => {
            wx.reLaunch({ url: '/pages/index/index' });
          }
        });
      }, 1500);
      return;
    }

    this.setData({
      activityId,
      linkId,
      retryCount: 0,  // 重试次数
    });

    this.loadActivityData();
  },

  onShow() {
    // 每次显示时刷新数据（可能从其他页面返回）
    if (this.data.activityId || this.data.linkId) {
      this.loadActivityData();
    }
  },

  onPullDownRefresh() {
    this.loadActivityData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadActivityData() {
    this.setData({ loading: true, error: '' });

    try {
      console.log('[Activity Detail] 开始加载活动数据:', {
        activityId: this.data.activityId,
        linkId: this.data.linkId,
        activityIdType: typeof this.data.activityId
      });

      // 根据linkId或activityId获取活动数据
      let response;
      if (this.data.linkId) {
        console.log('[Activity Detail] 使用 linkId 查询公开活动');
        response = await apiService.getPublicActivityDetail(this.data.linkId);
      } else if (this.data.activityId) {
        console.log('[Activity Detail] 使用 activityId 查询活动详情:', this.data.activityId);
        response = await apiService.getActivityDetail(this.data.activityId);
      } else {
        throw new Error('缺少活动ID或链接ID');
      }

      console.log('[Activity Detail] 活动数据响应:', response);

      if (response.success && response.data) {
        const activity = response.data;
        const items = activity.items || [];

        // 检查是否需要密码验证
        if (activity.is_password_protected && !this.data.isOwner && !this.data.isPasswordVerified) {
          console.log('[Activity Detail] 活动需要密码验证');
          this.setData({
            activity,
            showPasswordModal: true,
            passwordHint: activity.password_hint || '',
            loading: false
          });
          return;
        }

        // 检查是否是活动创建者
        const sessionToken = wx.getStorageSync('sessionToken');
        let isOwner = false;
        if (sessionToken) {
          try {
            const userResponse = await apiService.getUserInfo();
            if (userResponse.success && userResponse.data) {
              // 比较用户ID和活动创建者ID
              isOwner = userResponse.data.id === activity.influencer_id;
            }
          } catch (error) {
            // 忽略错误，保持isOwner为false
          }
        }

        // 如果是创建者，获取订单列表
        let orders = [];
        if (isOwner && this.data.activityId) {
          try {
            const ordersResponse = await apiService.getOrders({activity_id: this.data.activityId});
            if (ordersResponse.success) {
              orders = (ordersResponse.data.orders || []).map((order) => ({
                ...order,
                itemLabel: (order.item && order.item.label) || order.item_label || '物品',
              }));
            }
          } catch (error) {
            console.error('Load orders error:', error);
          }
        }

        // 计算已领取物品数量
        const claimedItemsCount = items.filter((item) => item.status === 'claimed').length;

        console.log('[Activity Detail] 设置页面数据:', {
          activity_id: activity.activity_id,
          title: activity.title,
          items_count: items.length,
          items_sample: items.length > 0 ? items[0] : null,  // 打印第一个物品的结构
          items_photos: items.map(item => ({ 
            item_id: item.item_id, 
            label: item.label,
            photo_urls: item.photo_urls,
            photo_count: item.photo_urls ? item.photo_urls.length : 0
          })),
          isOwner
        });

        // 转换所有图片链接
        const activityWithConvertedUrls = await this.convertAllImageUrls(activity, items);

        this.setData({
          activity: activityWithConvertedUrls,
          items: activityWithConvertedUrls.items,
          orders,
          isOwner,
          claimedItemsCount,
          loading: false,
        });
      } else {
        throw new Error(response.error?.message || '加载活动失败');
      }
    } catch (error) {
      console.error('[Activity Detail] 加载活动出错:', error);
      
      // 特殊处理：如果是文档不存在的错误
      let errorMessage = error.message || '加载失败，请重试';
      let shouldRetry = false;
      
      if (error.message && error.message.includes('does not exist')) {
        errorMessage = '活动不存在或已被删除';
        // 如果是刚创建的活动，可能是同步延迟
        if (this.data.activityId && this.data.retryCount < this.data.maxRetries) {
          errorMessage = `活动正在创建中，请稍后刷新 (重试${this.data.retryCount + 1}/${this.data.maxRetries})`;
          shouldRetry = true;
        }
      }
      
      this.setData({
        loading: false,
        error: errorMessage,
      });

      // 如果需要重试
      if (shouldRetry) {
        setTimeout(() => {
          this.setData({
            retryCount: this.data.retryCount + 1
          });
          this.loadActivityData();
        }, 2000);
      }
    }
  },

  // 转换所有图片链接（cloud:// -> 临时链接）
  async convertAllImageUrls(activity, items) {
    if (!activity && (!items || items.length === 0)) {
      return { activity, items };
    }

    try {
      // 收集所有需要转换的 fileID
      const allFileIds = [];
      const fileIdMap = {}; // 记录 fileID 在哪个位置

      // 转换活动封面图
      if (activity.cover_image_url && activity.cover_image_url.startsWith('cloud://')) {
        const fileId = activity.cover_image_url;
        if (!fileIdMap[fileId]) {
          allFileIds.push(fileId);
          fileIdMap[fileId] = [];
        }
        fileIdMap[fileId].push({ type: 'cover', activity });
      }

      // 转换用户头像（如果需要）
      if (activity.influencer && activity.influencer.avatar_url && activity.influencer.avatar_url.startsWith('cloud://')) {
        const fileId = activity.influencer.avatar_url;
        if (!fileIdMap[fileId]) {
          allFileIds.push(fileId);
          fileIdMap[fileId] = [];
        }
        fileIdMap[fileId].push({ type: 'avatar', activity });
      }

      // 转换物品图片
      if (items && Array.isArray(items)) {
        items.forEach((item, itemIndex) => {
          if (item.photo_urls && Array.isArray(item.photo_urls)) {
            item.photo_urls.forEach((fileId, urlIndex) => {
              if (fileId && fileId.startsWith('cloud://')) {
                if (!fileIdMap[fileId]) {
                  allFileIds.push(fileId);
                  fileIdMap[fileId] = [];
                }
                fileIdMap[fileId].push({ type: 'item', item, itemIndex, urlIndex });
              }
            });
          }
        });
      }

      // 如果没有需要转换的 fileID，直接返回原数据
      if (allFileIds.length === 0) {
        return { ...activity, items };
      }

      console.log('[ActivityDetail] 需要转换的图片数量:', allFileIds.length);

      // 批量获取临时链接，设置最大过期时间为2小时
      const result = await wx.cloud.getTempFileURL({
          fileList: allFileIds,
          maxAge: 86400 // 24小时有效期
        });

      console.log('[ActivityDetail] getTempFileURL result:', result);

      // 检查是否有错误
      if (result.errMsg && !result.errMsg.includes('ok')) {
        console.error('[ActivityDetail] getTempFileURL failed:', result.errMsg);
        throw new Error('获取图片链接失败: ' + result.errMsg);
      }

      // 创建 fileID 到 tempFileURL 的映射
      const fileIdToTempUrl = {};
      if (result.fileList) {
        result.fileList.forEach(file => {
          console.log('[ActivityDetail] File conversion result:', {
            fileID: file.fileID,
            status: file.status,
            tempFileURL: file.tempFileURL
          });

          // 检查文件状态和临时链接
          if (file.status === 0 && file.tempFileURL && file.tempFileURL.includes('sign=')) {
            // 检查链接是否有效（包含签名且未过期）
            try {
              // 在小程序环境中使用正则表达式解析URL
              const timestampMatch = file.tempFileURL.match(/[?&]t=(\d+)/);
              if (timestampMatch) {
                const timestamp = parseInt(timestampMatch[1]);
                const currentTime = Math.floor(Date.now() / 1000);
                
                // 如果时间戳不存在或已过期（超过2小时），记录警告但仍使用链接
                if ((currentTime - timestamp) > 7200) {
                  console.warn('[ActivityDetail] 临时链接可能已过期:', file.fileID);
                }
              } else {
                console.warn('[ActivityDetail] 临时链接缺少时间戳:', file.fileID);
              }
              
              fileIdToTempUrl[file.fileID] = file.tempFileURL;
            } catch (urlError) {
              console.error('[ActivityDetail] 解析临时链接URL失败:', file.tempFileURL, urlError);
            }
          } else {
            console.error('[ActivityDetail] File conversion failed:', {
              fileID: file.fileID,
              status: file.status,
              errMsg: file.errMsg
            });
          }
        });
      }

      // 创建新的 activity 和 items（深拷贝）
      const newActivity = JSON.parse(JSON.stringify(activity));
      const newItems = JSON.parse(JSON.stringify(items));

      // 替换所有 fileID 为临时链接
      Object.keys(fileIdMap).forEach(fileId => {
        const tempUrl = fileIdToTempUrl[fileId];
        if (tempUrl) {
          fileIdMap[fileId].forEach(location => {
            switch (location.type) {
              case 'cover':
                newActivity.cover_image_url = tempUrl;
                break;
              case 'avatar':
                newActivity.influencer.avatar_url = tempUrl;
                break;
              case 'item':
                newItems[location.itemIndex].photo_urls[location.urlIndex] = tempUrl;
                break;
            }
          });
        } else {
          console.warn('[Activity Detail] Failed to get temp URL for file:', fileId);
        }
      });

      console.log('[Activity Detail] 图片转换完成');
      return { ...newActivity, items: newItems };

    } catch (error) {
      console.error('[Activity Detail] 转换图片链接失败:', error);
      // 转换失败时返回原数据
      return { ...activity, items };
    }
  },

  onItemTap(e) {
    const itemId = e.currentTarget.dataset.id;
    
    console.log('[onItemTap] 点击物品:', {
      itemId,
      items: this.data.items,
      activityId: this.data.activityId,
      activity_id: this.data.activity?.activity_id
    });
    
    if (!itemId) {
      console.error('[onItemTap] 缺少物品ID');
      wx.showToast({
        title: '缺少物品ID',
        icon: 'none'
      });
      return;
    }
    
    const item = this.data.items.find((i) => i.item_id === itemId);

    if (!item) {
      console.error('[onItemTap] 未找到物品:', itemId);
      wx.showToast({
        title: '未找到物品',
        icon: 'none'
      });
      return;
    }

    if (item.status === 'available' || item.remaining_quantity > 0) {
      // 跳转到领取页面
      const activityId = this.data.activityId || this.data.activity?.activity_id;
      
      console.log('[onItemTap] 跳转到领取页面:', {
        item_id: itemId,
        activity_id: activityId
      });
      
      wx.navigateTo({
        url: `/pages/claim-item/claim-item?item_id=${itemId}&activity_id=${activityId}`,
      });
    } else {
      wx.showToast({
        title: '该物品已被领取',
        icon: 'none',
      });
    }
  },

  onImageError(e) {
    console.error('[Activity Detail] 图片加载失败:', e.detail);
  },

  onOrderTap(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/order-detail/order-detail?id=${orderId}`,
    });
  },

  onShare() {
    this.setData({ showShareModal: true });
  },

  onCloseShareModal() {
    this.setData({ showShareModal: false });
  },

  onCopyLink() {
    const link = `${getApp().globalData.apiBaseUrl}/activities/public/${this.data.linkId || this.data.activity.shareable_link}`;
    wx.setClipboardData({
      data: link,
      success: () => {
        wx.showToast({
          title: '链接已复制',
          icon: 'success',
        });
      },
    });
  },

  onEditActivity() {
    // TODO: 实现编辑活动功能
    wx.showToast({
      title: '编辑功能开发中',
      icon: 'none',
    });
  },

  onCancelActivity() {
    wx.showModal({
      title: '确认取消',
      content: '确定要取消这个活动吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const response = await apiService.updateActivity(this.data.activityId, {
              status: 'cancelled',
            });

            if (response.success) {
              wx.showToast({
                title: '活动已取消',
                icon: 'success',
              });
              this.loadActivityData();
            } else {
              throw new Error(response.error?.message || '取消失败');
            }
          } catch (error) {
            wx.showToast({
              title: error.message || '取消失败',
              icon: 'none',
            });
          }
        }
      },
    });
  },

  onScanQRCode() {
    // 扫描二维码匹配订单
    wx.navigateTo({
      url: '/pages/my-activities/my-activities',
    });
  },

  // 密码验证相关方法
  onPasswordInput(e) {
    this.setData({
      inputPassword: e.detail.value,
      passwordError: ''
    });
  },

  onCancelPassword() {
    this.setData({
      showPasswordModal: false,
      inputPassword: '',
      passwordError: ''
    });
    
    // 返回上一页
    wx.navigateBack({
      fail: () => {
        wx.reLaunch({ url: '/pages/index/index' });
      }
    });
  },

  onConfirmPassword() {
    const { inputPassword, activity } = this.data;
    
    if (!inputPassword) {
      this.setData({ passwordError: '请输入密码' });
      return;
    }
    
    // 验证密码
    if (inputPassword === activity.access_password) {
      this.setData({
        showPasswordModal: false,
        isPasswordVerified: true,
        inputPassword: '',
        passwordError: ''
      });
      
      // 重新加载活动数据
      this.loadActivityData();
    } else {
      this.setData({ passwordError: '密码错误，请重试' });
    }
  },

  /**
   * 处理图片加载错误
   * @param {Object} event - 事件对象
   */
  handleImageError: function(event) {
    const { dataset } = event.currentTarget;
    const { fileId, type, index } = dataset;
    
    console.warn('[ActivityDetail] 图片加载失败:', {
      fileId,
      type,
      index
    });
    
    // 获取当前图片URL
    let currentUrl = '';
    let updatePath = '';
    
    if (type === 'activity') {
      currentUrl = this.data.activity.cover_image_url;
      updatePath = 'activity.cover_image_url';
    } else if (type === 'avatar') {
      currentUrl = this.data.activity.influencer.avatar_url;
      updatePath = 'activity.influencer.avatar_url';
    } else if (type === 'item') {
      currentUrl = this.data.activity.items[index].photo_urls[0];
      updatePath = `activity.items[${index}].photo_urls[0]`;
    }
    
    // 如果是云函数已经转换过的临时链接，直接使用默认图片
    if (currentUrl.startsWith('https://')) {
      console.log('[ActivityDetail] 使用云函数转换的临时链接失败，使用默认图片');
      
      // 设置默认图片
      if (type === 'activity') {
        this.setData({
          'activity.cover_image_url': '/images/default-activity.jpg'
        });
      } else if (type === 'avatar') {
        this.setData({
          'activity.influencer.avatar_url': '/images/default-avatar.png'
        });
      } else if (type === 'item') {
        this.setData({
          [`activity.items[${index}].photo_urls[0]`]: '/images/default-item.jpg'
        });
      }
      return;
    }
    
    // 只有当fileId是cloud://格式时才尝试重新获取临时链接
    if (fileId && fileId.startsWith('cloud://')) {
      // 使用错误处理工具重试获取图片URL
      handleImageError(currentUrl, fileId, {
        maxRetries: 2,
        retryDelay: 500,
        onRetry: (retryCount, maxRetries) => {
          console.log(`[ActivityDetail] 正在重试获取图片URL (${retryCount}/${maxRetries}):`, fileId);
        },
        onError: (error) => {
          console.error('[ActivityDetail] 图片URL重试失败:', error);
          // 设置默认图片
          if (type === 'activity') {
            this.setData({
              'activity.cover_image_url': '/images/default-activity.jpg'
            });
          } else if (type === 'avatar') {
            this.setData({
              'activity.influencer.avatar_url': '/images/default-avatar.png'
            });
          } else if (type === 'item') {
            this.setData({
              [`activity.items[${index}].photo_urls[0]`]: '/images/default-item.jpg'
            });
          }
        }
      }).then(newUrl => {
        // 更新图片URL
        if (newUrl && newUrl !== currentUrl) {
          this.setData({
            [updatePath]: newUrl
          });
          console.log('[ActivityDetail] 图片URL更新成功:', newUrl);
        }
      }).catch(error => {
        console.error('[ActivityDetail] 处理图片错误失败:', error);
      });
    } else {
      console.log('[ActivityDetail] 无效的fileID格式，使用默认图片');
      // 设置默认图片
      if (type === 'activity') {
        this.setData({
          'activity.cover_image_url': '/images/default-activity.jpg'
        });
      } else if (type === 'avatar') {
        this.setData({
          'activity.influencer.avatar_url': '/images/default-avatar.png'
        });
      } else if (type === 'item') {
        this.setData({
          [`activity.items[${index}].photo_urls[0]`]: '/images/default-item.jpg'
        });
      }
    }
  },
});

