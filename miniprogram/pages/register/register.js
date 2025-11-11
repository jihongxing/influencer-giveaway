// pages/register/register.js
const apiService = require('../../services/api-cloud').default;

/**
 * 注册页面 - 简化版
 * 针对个人认证小程序限制，仅需用户输入昵称即可完成注册
 * 手机号和地址相关信息可在个人中心后续完善
 */
Page({
  data: {
    nickname: '',
    loading: false,
  },

  /**
   * 页面加载时初始化
   */
  onLoad() {
    // 页面加载时不自动获取用户信息
    // 微信要求用户交互才能触发相关功能
  },
  
  /**
   * 处理昵称输入
   * @param {Object} e - 输入事件对象
   */
  onNicknameInput(e) {
    this.setData({
      nickname: e.detail.value
    });
  },

  /**
   * 提交注册
   * 仅验证昵称非空，简化注册流程
   */
  async onSubmit() {
    const { nickname } = this.data;

    // 验证昵称
    if (!nickname || nickname.trim() === '') {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true });

    try {
      // 获取微信登录 code
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject,
        });
      });

      // 准备注册数据 - 仅包含必要信息
      const registerData = {
        wechat_code: loginRes.code,
        nickname: nickname.trim(),
        avatar_url: '', // 个人认证版本不需要头像
        // 手机号和地址相关信息留空，用户可在个人中心后续完善
      };

      console.log('注册数据:', registerData);
      
      // 调用注册 API
      const response = await apiService.register(registerData, false);

      if (response.success) {
        // 保存 session token
        apiService.setSessionToken(response.data.session_token);
        getApp().globalData.userInfo = response.data;

        // 检查是否为已存在用户（自动登录）
        const isExistingUser = response.data.is_existing_user;
        const toastTitle = isExistingUser ? '欢迎回来！' : '注册成功';
        
        wx.showToast({
          title: toastTitle,
          icon: 'success',
        });

        // 跳转到首页
        setTimeout(() => {
          wx.switchTab({
            url: '/pages/index/index',
          });
        }, 1500);
      } else {
        // 不应该走到这里，因为云函数已经处理了账号已存在的情况
        console.error('注册失败:', response);
        throw new Error(response.error?.message || '注册失败');
      }
    } catch (error) {
      console.error('注册失败:', error);
      wx.showToast({
        title: error.message || '注册失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },
});
