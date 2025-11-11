// pages/profile/profile.js
const apiService = require('../../services/api-cloud').default;
const AppConfig = require('../../config/app-config');

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    stats: {
      activitiesCount: 0,
      ordersCount: 0,
      itemsSent: 0,
    },
    recentActivities: [],
    recentOrders: [],
    loading: true,
    updating: false,
    // 用户信息完整度状态
    missingInfo: {
      basicInfo: false, // 缺少昵称和头像
      phoneNumber: false, // 缺少手机号
      shippingAddress: false, // 缺少收货地址
    }
  },

  onLoad() {
    this.checkLoginStatus();
  },

  onShow() {
    // 每次显示时刷新数据
    this.checkLoginStatus();
  },

  onPullDownRefresh() {
    this.loadUserData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  checkLoginStatus() {
    const sessionToken = wx.getStorageSync('sessionToken');
    if (sessionToken) {
      this.setData({ isLoggedIn: true });
      this.loadUserData();
    } else {
      this.setData({ isLoggedIn: false, loading: false });
    }
  },

  async loadUserData() {
    this.setData({ loading: true });

    try {
      // 获取用户信息
      try {
        const userResponse = await apiService.getUserInfo();
        if (userResponse.success) {
          const userInfo = userResponse.data;
          
          // 检查用户信息完整度
          const missingInfo = {
            basicInfo: !userInfo.nickname || !userInfo.avatar_url,
            phoneNumber: !userInfo.phone_number,
            shippingAddress: !userInfo.shipping_address || 
                            !userInfo.shipping_contact_name || 
                            !userInfo.shipping_contact_phone
          };
          
          this.setData({
            userInfo: userInfo,
            missingInfo: missingInfo
          });
        }
      } catch (error) {
        console.error('Get user info error:', error);
      }

      // 获取我的活动（最近3个）
      try {
        const activitiesResponse = await apiService.getActivities({ page: 1, limit: 3 });
        if (activitiesResponse.success) {
          const activities = activitiesResponse.data || [];
          this.setData({
            recentActivities: activities,
            stats: {
              ...this.data.stats,
              activitiesCount: activities.length || 0,
            },
          });
        }
      } catch (error) {
        console.error('Get activities error:', error);
      }

      // 获取我的订单（最近3个）
      try {
        const ordersResponse = await apiService.getOrders({ page: 1, limit: 3 });
        if (ordersResponse.success) {
          const orders = (ordersResponse.data.orders || []).map((order) => ({
            ...order,
            itemLabel: (order.item && order.item.label) || order.item_label || '物品',
          }));
          this.setData({
            recentOrders: orders,
            stats: {
              ...this.data.stats,
              ordersCount: orders.length,
            },
          });
        }
      } catch (error) {
        console.error('Get orders error:', error);
      }

      this.setData({ loading: false });
    } catch (error) {
      console.error('Load user data error:', error);
      this.setData({ loading: false });
      // 如果未登录，不显示错误
      if (!(error.error && error.error.code === 'UNAUTHORIZED')) {
        wx.showToast({
          title: error.message || '加载失败',
          icon: 'none',
        });
      }
    }
  },

  onLogin() {
    wx.navigateTo({
      url: '/pages/register/register',
    });
  },

  /**
   * 获取微信用户基本信息（昵称、头像）
   * 必须由用户点击触发，不能在页面加载时自动调用
   */
  async getUserBasicInfo() {
    try {
      const userInfo = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于完善用户资料',
          success: (res) => {
            resolve(res.userInfo);
          },
          fail: (err) => {
            console.error('Get user info error:', err);
            reject(new Error(err.errMsg || '获取用户信息失败，请重试'));
          },
        });
      });

      // 更新用户信息到云端
      await this.updateUserInfo({
        nickname: userInfo.nickName,
        avatar_url: userInfo.avatarUrl
      });

      wx.showToast({
        title: '用户信息更新成功',
        icon: 'success',
      });
    } catch (error) {
      console.error('Get user info error:', error);
      wx.showToast({
        title: error.message || '获取用户信息失败',
        icon: 'none',
      });
    }
  },

  /**
   * 获取微信手机号授权
   */
  async getUserPhoneNumber(e) {
    // 检查是否支持微信授权
    if (!AppConfig.features.phoneNumberAuth) {
      // 个人认证小程序，使用手动输入
      this.showManualPhoneInput();
      return;
    }
    
    if (!e.detail.code) {
      wx.showToast({
        title: '需要授权手机号才能继续',
        icon: 'none',
      });
      return;
    }

    this.setData({ updating: true });

    try {
      // 将 code 发送到后端，后端通过微信 API 获取手机号
      const response = await apiService.getPhoneNumber(e.detail.code);

      if (response.success && response.data.phoneNumber) {
        // 更新用户信息到云端
        await this.updateUserInfo({
          phone_number: response.data.phoneNumber
        });

        wx.showToast({
          title: '手机号获取成功',
          icon: 'success',
        });
      } else {
        throw new Error(response.error?.message || '获取手机号失败');
      }
    } catch (error) {
      console.error('Get phone number error:', error);
      wx.showToast({
        title: error.message || '获取手机号失败',
        icon: 'none',
      });
    } finally {
      this.setData({ updating: false });
    }
  },

  /**
   * 手动输入手机号（个人认证小程序使用）
   */
  showManualPhoneInput() {
    wx.showModal({
      title: '输入手机号',
      editable: true,
      placeholderText: '请输入11位手机号',
      success: async (res) => {
        if (res.confirm && res.content) {
          const phoneNumber = res.content.trim();
          
          // 验证手机号格式
          if (!/^1[3-9]\d{9}$/.test(phoneNumber)) {
            wx.showToast({
              title: '请输入正确的手机号',
              icon: 'none'
            });
            return;
          }
          
          this.setData({ updating: true });
          
          try {
            // 更新用户信息到云端
            await this.updateUserInfo({
              phone_number: phoneNumber
            });

            wx.showToast({
              title: '手机号设置成功',
              icon: 'success',
            });
          } catch (error) {
            console.error('Update phone number error:', error);
            wx.showToast({
              title: '设置失败，请重试',
              icon: 'none',
            });
          } finally {
            this.setData({ updating: false });
          }
        }
      }
    });
  },

  /**
   * 选择收货地址
   */
  async chooseShippingAddress() {
    try {
      const res = await wx.chooseAddress();
      
      const addressData = {
        shipping_address: {
          province: res.provinceName,
          city: res.cityName,
          district: res.countyName,
          street: res.detailInfo,
          postalCode: res.postalCode || ''
        },
        shipping_contact_name: res.userName,
        shipping_contact_phone: res.telNumber
      };
      
      // 更新用户信息到云端
      await this.updateUserInfo(addressData);

      wx.showToast({
        title: '地址获取成功',
        icon: 'success',
      });
    } catch (error) {
      console.error('Choose address error:', error);
      if (error.errMsg && error.errMsg.includes('cancel')) {
        // 用户取消，不显示错误
        return;
      }
      wx.showToast({
        title: '获取地址失败，请重试',
        icon: 'none',
      });
    }
  },

  /**
   * 更新用户信息到云端
   */
  async updateUserInfo(updateData) {
    try {
      // 调用云函数更新用户信息
      // 注意：这里需要确保auth云函数支持updateProfile操作
      const response = await apiService.callCloudFunction('auth', 'updateProfile', updateData);
      
      if (response.success) {
        // 重新加载用户数据以更新界面
        await this.loadUserData();
        return true;
      } else {
        throw new Error(response.error?.message || '更新用户信息失败');
      }
    } catch (error) {
      console.error('Update user info error:', error);
      throw error;
    }
  },

  /**
   * 编辑个人资料入口
   */
  onEditProfile() {
    wx.showModal({
      title: '编辑资料',
      content: '请选择需要完善的信息',
      showCancel: false
    });
  },

  onViewAllActivities() {
    wx.navigateTo({
      url: '/pages/my-activities/my-activities',
    });
  },

  onViewAllOrders() {
    wx.navigateTo({
      url: '/pages/my-orders/my-orders',
    });
  },

  onActivityTap(e) {
    const activityId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/activity-detail/activity-detail?id=${activityId}`,
    });
  },

  onOrderTap(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/order-detail/order-detail?id=${orderId}`,
    });
  },

  onCreateActivity() {
    wx.switchTab({
      url: '/pages/create-giveaway/create-giveaway',
    });
  },

  onSettings() {
    wx.showModal({
      title: '设置',
      content: '请选择操作',
      showCancel: true,
      cancelText: '取消',
      confirmText: '退出登录',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          this.onLogout();
        }
      }
    });
  },

  onHelp() {
    // TODO: 实现帮助中心
    wx.showToast({
      title: '帮助中心开发中',
      icon: 'none',
    });
  },

  /**
   * 退出登录
   */
  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      confirmText: '退出',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          this.doLogout();
        }
      }
    });
  },

  /**
   * 执行退出登录
   */
  doLogout() {
    // 1. 清除本地存储的 session token
    apiService.clearSessionToken();
    
    // 2. 清除全局数据
    const app = getApp();
    if (app.globalData) {
      app.globalData.userInfo = null;
      app.globalData.sessionToken = null;
    }
    
    // 3. 清除页面数据
    this.setData({
      userInfo: null,
      isLoggedIn: false,
      stats: {
        activitiesCount: 0,
        ordersCount: 0,
        itemsSent: 0,
      },
      recentActivities: [],
      recentOrders: []
    });
    
    // 4. 显示退出成功提示
    wx.showToast({
      title: '已退出登录',
      icon: 'success',
      duration: 1500
    });
    
    // 5. 可选：跳转到首页
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/index/index'
      });
    }, 1500);
  }
});

