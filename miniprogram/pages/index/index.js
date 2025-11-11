// pages/index/index.js
// 使用云函数 API 服务
const apiService = require('../../services/api-cloud').default;

// 引入图片错误处理工具
const { handleImageError, batchHandleImageErrors } = require('../../utils/image-error-handler');

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    activities: [],
    loading: true,
    error: '',
    page: 1,
    limit: 10,
    hasMore: true,
    category: '', // 当前选中的分类
  },

  onLoad() {
    this.checkLoginStatus();
    this.loadActivities();
  },

  onShow() {
    // 每次显示时刷新（可能从其他页面返回）
    this.checkLoginStatus();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, activities: [], hasMore: true });
    this.loadActivities().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadActivities();
    }
  },

  checkLoginStatus() {
    const sessionToken = wx.getStorageSync('sessionToken');
    if (sessionToken) {
      this.setData({ isLoggedIn: true });
      // 获取用户信息
      apiService
        .getUserInfo()
        .then((response) => {
          if (response.success) {
            this.setData({ userInfo: response.data });
          }
        })
        .catch((error) => {
          // 处理用户不存在的情况，清除无效的sessionToken
          console.error('获取用户信息失败:', error);
          if (error.code === 'USER_NOT_FOUND') {
            // 清除本地存储的无效sessionToken
            wx.removeStorageSync('sessionToken');
            this.setData({ isLoggedIn: false, userInfo: null });
          }
          // 其他错误暂时忽略
        });
    } else {
      this.setData({ isLoggedIn: false, userInfo: null });
    }
  },

  async loadActivities() {
    if (this.data.loading && this.data.page > 1) {
      return; // Already loading
    }

    this.setData({ loading: true, error: '' });

    try {
      // 获取推荐活动（未登录显示热门，已登录显示推荐）
      const params = {
        page: this.data.page,
        limit: this.data.limit,
        status: 'active',
      };

      if (this.data.category) {
        params.category = this.data.category;
      }

      const response = await apiService.getPublicActivities(params);

      console.log('[Index] Response:', response);
      console.log('[Index] Response.data:', response.data);
      console.log('[Index] Response.data?.pagination:', response.data?.pagination);

      if (response && response.success) {
        // 根据云函数的实现，活动列表在response.data.activities中
        let newActivities = [];
        if (response.data && Array.isArray(response.data.activities)) {
          newActivities = response.data.activities;
        }

        // 根据云函数的实现，分页信息在response.data.pagination中
        let pagination = {};
        if (response.data && response.data.pagination) {
          pagination = response.data.pagination;
        }

        console.log('[Index] New activities:', newActivities);
        console.log('[Index] Pagination:', pagination);

        // 安全地访问 pagination 属性
        const currentPage = pagination.page || this.data.page || 1;
        const totalPages = pagination.total_pages || 0;
        const hasMore = pagination && typeof pagination.page === 'number' && typeof pagination.total_pages === 'number' 
          ? pagination.page < pagination.total_pages 
          : false;

        // 转换所有图片链接
        const activitiesWithConvertedUrls = await this.convertAllImageUrls(newActivities);

        this.setData({
          activities: this.data.page === 1 ? activitiesWithConvertedUrls : [...this.data.activities, ...activitiesWithConvertedUrls],
          hasMore: hasMore,
          loading: false,
        });
      } else {
        const errorMsg = (response && response.error && response.error.message) ? response.error.message : '加载失败';
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Load activities error:', error);
      const errorMessage = error.message || '加载失败，请重试';
      this.setData({
        loading: false,
        error: errorMessage,
      });
      
      // 如果是网络错误，显示更友好的提示
      if (errorMessage.includes('无法连接到服务器')) {
        wx.showToast({
          title: '无法连接服务器',
          icon: 'none',
          duration: 3000,
        });
      }
    }
  },

  // 转换所有图片链接（cloud:// -> 临时链接）
  async convertAllImageUrls(activities) {
    if (!activities || activities.length === 0) {
      return activities;
    }

    try {
      // 收集所有需要转换的 fileID
      const allFileIds = [];
      const fileIdMap = {}; // 记录 fileID 在哪个活动和物品中

      activities.forEach((activity, activityIndex) => {
        // 转换活动封面图
        if (activity.cover_image_url && activity.cover_image_url.startsWith('cloud://')) {
          const fileId = activity.cover_image_url;
          if (!fileIdMap[fileId]) {
            allFileIds.push(fileId);
            fileIdMap[fileId] = [];
          }
          fileIdMap[fileId].push({ type: 'cover', activityIndex });
        }

        // 转换用户头像（如果需要）
        if (activity.influencer && activity.influencer.avatar_url && activity.influencer.avatar_url.startsWith('cloud://')) {
          const fileId = activity.influencer.avatar_url;
          if (!fileIdMap[fileId]) {
            allFileIds.push(fileId);
            fileIdMap[fileId] = [];
          }
          fileIdMap[fileId].push({ type: 'avatar', activityIndex });
        }

        // 转换物品图片
        if (activity.items && Array.isArray(activity.items)) {
          activity.items.forEach((item, itemIndex) => {
            if (item.photo_urls && Array.isArray(item.photo_urls)) {
              item.photo_urls.forEach((fileId, urlIndex) => {
                if (fileId && fileId.startsWith('cloud://')) {
                  if (!fileIdMap[fileId]) {
                    allFileIds.push(fileId);
                    fileIdMap[fileId] = [];
                  }
                  fileIdMap[fileId].push({ type: 'item', activityIndex, itemIndex, urlIndex });
                }
              });
            }
          });
        }
      });

      // 如果没有需要转换的 fileID，直接返回原数据
      if (allFileIds.length === 0) {
        return activities;
      }

      console.log('[Index] 需要转换的图片数量:', allFileIds.length);

      // 批量获取临时链接，设置最大过期时间为2小时
      const result = await wx.cloud.getTempFileURL({
          fileList: allFileIds,
          maxAge: 86400 // 24小时有效期
        });

      console.log('[Index] getTempFileURL result:', result);

      // 检查是否有错误
      if (result.errMsg && !result.errMsg.includes('ok')) {
        console.error('[Index] getTempFileURL failed:', result.errMsg);
        throw new Error('获取图片链接失败: ' + result.errMsg);
      }

      // 创建 fileID 到 tempFileURL 的映射
      const fileIdToTempUrl = {};
      if (result.fileList) {
        result.fileList.forEach(file => {
          console.log('[Index] File conversion result:', {
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
                  console.warn('[Index] 临时链接可能已过期:', file.fileID);
                }
              } else {
                console.warn('[Index] 临时链接缺少时间戳:', file.fileID);
              }
              
              fileIdToTempUrl[file.fileID] = file.tempFileURL;
            } catch (urlError) {
              console.error('[Index] 解析临时链接URL失败:', file.tempFileURL, urlError);
            }
          } else {
            console.error('[Index] File conversion failed:', {
              fileID: file.fileID,
              status: file.status,
              errMsg: file.errMsg
            });
          }
        });
      }

      // 创建新的 activities 数组（深拷贝）
      const newActivities = JSON.parse(JSON.stringify(activities));

      // 替换所有 fileID 为临时链接
      Object.keys(fileIdMap).forEach(fileId => {
        const tempUrl = fileIdToTempUrl[fileId];
        if (tempUrl) {
          fileIdMap[fileId].forEach(location => {
            switch (location.type) {
              case 'cover':
                newActivities[location.activityIndex].cover_image_url = tempUrl;
                break;
              case 'avatar':
                newActivities[location.activityIndex].influencer.avatar_url = tempUrl;
                break;
              case 'item':
                newActivities[location.activityIndex].items[location.itemIndex].photo_urls[location.urlIndex] = tempUrl;
                break;
            }
          });
        } else {
          console.warn('[Index] Failed to get temp URL for file:', fileId);
        }
      });

      console.log('[Index] 图片转换完成');
      return newActivities;

    } catch (error) {
      console.error('[Index] 转换图片链接失败:', error);
      // 转换失败时返回原数据
      return activities;
    }
  },

  onCategoryChange(e) {
    const category = e.currentTarget.dataset.category || '';
    this.setData({ category, page: 1, activities: [], hasMore: true });
    this.loadActivities();
  },

  onActivityTap(e) {
    const activityId = e.currentTarget.dataset.id;
    const linkId = e.currentTarget.dataset.linkId;
    
    wx.navigateTo({
      url: `/pages/activity-detail/activity-detail?id=${activityId}&link_id=${linkId}`,
    });
  },

  onSearch() {
    // 跳转到发现页进行搜索
    wx.switchTab({
      url: '/pages/explore/explore',
    });
  },

  onLogin() {
    wx.navigateTo({
      url: '/pages/register/register',
    });
  },

  /**
   * 处理图片加载错误
   * @param {Object} event - 事件对象
   */
  handleImageError: function(event) {
    const { dataset } = event.currentTarget;
    const { fileId, type, index, itemIndex } = dataset;
    
    console.warn('[Index] 图片加载失败:', {
      fileId,
      type,
      index,
      itemIndex
    });
    
    // 获取当前图片URL
    let currentUrl = '';
    let updatePath = '';
    
    if (type === 'activity') {
      currentUrl = this.data.activities[index].cover_image_url;
      updatePath = `activities[${index}].cover_image_url`;
    } else if (type === 'avatar') {
      currentUrl = this.data.activities[index].influencer.avatar_url;
      updatePath = `activities[${index}].influencer.avatar_url`;
    } else if (type === 'item' && itemIndex !== undefined) {
      currentUrl = this.data.activities[index].items[itemIndex].photo_urls[0];
      updatePath = `activities[${index}].items[${itemIndex}].photo_urls[0]`;
    }
    
    // 如果是云函数已经转换过的临时链接，直接使用默认图片
    if (currentUrl.startsWith('https://')) {
      console.log('[Index] 使用云函数转换的临时链接失败，使用默认图片');
      
      // 设置默认图片
      if (type === 'activity') {
        this.setData({
          [`activities[${index}].cover_image_url`]: '/images/default-activity.jpg'
        });
      } else if (type === 'avatar') {
        this.setData({
          [`activities[${index}].influencer.avatar_url`]: '/images/default-avatar.png'
        });
      } else if (type === 'item' && itemIndex !== undefined) {
        this.setData({
          [`activities[${index}].items[${itemIndex}].photo_urls[0]`]: '/images/default-item.jpg'
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
          console.log(`[Index] 正在重试获取图片URL (${retryCount}/${maxRetries}):`, fileId);
        },
        onError: (error) => {
          console.error('[Index] 图片URL重试失败:', error);
          // 设置默认图片
          if (type === 'activity') {
            this.setData({
              [`activities[${index}].cover_image_url`]: '/images/default-activity.jpg'
            });
          } else if (type === 'avatar') {
            this.setData({
              [`activities[${index}].influencer.avatar_url`]: '/images/default-avatar.png'
            });
          } else if (type === 'item' && itemIndex !== undefined) {
            this.setData({
              [`activities[${index}].items[${itemIndex}].photo_urls[0]`]: '/images/default-item.jpg'
            });
          }
        }
      }).then(newUrl => {
        // 更新图片URL
        if (newUrl && newUrl !== currentUrl) {
          this.setData({
            [updatePath]: newUrl
          });
          console.log('[Index] 图片URL更新成功:', newUrl);
        }
      }).catch(error => {
        console.error('[Index] 处理图片错误失败:', error);
      });
    } else {
      console.log('[Index] 无效的fileID格式，使用默认图片');
      // 设置默认图片
      if (type === 'activity') {
        this.setData({
          [`activities[${index}].cover_image_url`]: '/images/default-activity.jpg'
        });
      } else if (type === 'avatar') {
        this.setData({
          [`activities[${index}].influencer.avatar_url`]: '/images/default-avatar.png'
        });
      } else if (type === 'item' && itemIndex !== undefined) {
        this.setData({
          [`activities[${index}].items[${itemIndex}].photo_urls[0]`]: '/images/default-item.jpg'
        });
      }
    }
  },
});