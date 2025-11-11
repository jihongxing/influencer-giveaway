// app.js
App({
  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-8gezjcq432191d0d', // 云开发环境 ID
        traceUser: true,
      });
      console.log('云开发初始化成功');
    }

    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || [];
    logs.unshift(Date.now());
    wx.setStorageSync('logs', logs);

    // 登录
    wx.login({
      success: (res) => {
        console.log('WeChat login success:', res.code);
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
        // 现在通过云函数处理
      }
    });

    // 检查更新
    this.checkUpdate();
  },

  onShow() {
    // 小程序显示时
  },

  onHide() {
    // 小程序隐藏时
  },

  onError(msg) {
    console.error('App error:', msg);
  },

  /**
   * 检查小程序更新
   */
  checkUpdate() {
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager();
      updateManager.onCheckForUpdate((res) => {
        if (res.hasUpdate) {
          updateManager.onUpdateReady(() => {
            wx.showModal({
              title: '更新提示',
              content: '新版本已经准备好，是否重启应用？',
              success: (res) => {
                if (res.confirm) {
                  updateManager.applyUpdate();
                }
              },
            });
          });
        }
      });
    }
  },

  globalData: {
    userInfo: null,
    sessionToken: null,
    // 已迁移到云开发，不再需要 apiBaseUrl
    // 所有 API 调用通过云函数进行
    useCloudFunctions: true, // 标识使用云函数
  }
});

