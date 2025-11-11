// 云函数 API 服务层
// 替代原有的 HTTP API 调用，使用云函数

class CloudApiService {
  constructor() {
    // 检查是否已初始化云开发
    if (!wx.cloud) {
      console.error('云开发未初始化，请确保 app.js 中已初始化 wx.cloud');
    }
  }

  /**
   * 调用云函数
   * @param {string} name - 云函数名称
   * @param {string} action - 操作类型
   * @param {object} data - 数据
   * @returns {Promise}
   */
  async callCloudFunction(name, action, data = {}) {
    try {
      // 检查云开发是否已初始化
      if (!wx.cloud) {
        throw new Error('云开发未初始化，请确保 app.js 中已初始化 wx.cloud');
      }

      // 检查云函数名称
      if (!name || typeof name !== 'string') {
        throw new Error('云函数名称无效');
      }

      console.log(`调用云函数 ${name} 执行 ${action}`, data);

      // 构建调用参数 - 修复：将data包裹在data属性中
      const params = {
        action,
        data: data  // 确保云函数能正确解构 data 参数
      };

      // 调用云函数
      const res = await wx.cloud.callFunction({
        name,
        data: params
      });

      // 检查返回结果
      console.log(`[Cloud Function ${name}] Raw response:`, res);
      
      if (!res || !res.result) {
        throw new Error('云函数返回结果为空');
      }

      console.log(`[Cloud Function ${name}] Result:`, res.result);
      
      // 检查是否是系统错误
      if (res.errMsg && !res.errMsg.includes('ok')) {
        throw new Error(`云函数调用失败：${res.errMsg}`);
      }

      // 检查云函数返回的success字段
      if (!res.result.success) {
        // 处理云函数返回的错误
        const errorObj = res.result.error || {};
        const errorMessage = errorObj.message || 'Unknown error';
        console.error(`[Cloud Function ${name}] Error:`, errorObj);
        throw new Error(errorMessage);
      }

      // 确保返回的数据结构正确
      const result = {
        success: true,
        data: res.result.data || {},
        error: null
      };
      console.log(`[Cloud Function ${name}] Processed result:`, result);
      
      return result;
    } catch (error) {
      console.error(`调用云函数 ${name} 执行 ${action} 时出错:`, error);
      
      // 对常见错误进行分类处理
      let errorMessage = '请求失败，请稍后重试';
      
      if (error.errMsg) {
        // 检查是否是函数未找到的错误
        if (error.errMsg.includes('function not found') || 
            error.errMsg.includes('FunctionName parameter could not be found') ||
            error.errCode === -501000) {
          errorMessage = `云函数 "${name}" 未找到或未部署。请确保：\n1. 云函数已部署到云端\n2. 云函数名称正确\n3. 云开发环境ID正确`;
        } else if (error.errMsg.includes('timeout')) {
          errorMessage = '请求超时，请重试';
        } else if (error.errMsg.includes('request:fail')) {
          errorMessage = '网络连接失败，请检查网络后重试';
        } else {
          errorMessage = error.errMsg;
        }
      } else if (error.errCode) {
        errorMessage = `错误代码: ${error.errCode}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * 获取 session token
   */
  getSessionToken() {
    return wx.getStorageSync('sessionToken') || null;
  }

  /**
   * 设置 session token
   */
  setSessionToken(token) {
    wx.setStorageSync('sessionToken', token);
  }

  /**
   * 清除 session token
   */
  clearSessionToken() {
    wx.removeStorageSync('sessionToken');
  }

  // ========== 认证相关 ==========

  /**
   * 用户注册 - 个人认证版本
   * 仅需昵称和微信code即可完成注册，手机号和地址信息可后续在个人中心完善
   * @param {Object} data - 用户注册数据
   * @returns {Promise} 注册结果
   */
  async register(data) {
    try {
      // 构建简化的注册数据结构，只包含必要字段
      const simplifiedData = {
        wechat_code: data.wechat_code || '', // 必须的微信登录代码
        nickname: data.nickname || '微信用户', // 昵称
        avatar_url: data.avatar_url || '', // 头像URL（个人认证版本通常为空）
        // 以下字段为了兼容后端接口而设置为空或默认值，用户可在个人中心后续完善
        phone_number: '',
        shipping_address: {},
        shipping_contact_name: '',
        shipping_contact_phone: ''
      };
      
      console.log('个人认证版本注册数据:', simplifiedData);
      const response = await this.callCloudFunction('auth', 'register', simplifiedData);
      
      // 保存会话token
      if (response.success && response.data.session_token) {
        this.setSessionToken(response.data.session_token);
      }
      
      return response;
    } catch (error) {
      console.error('注册失败:', error);
      throw error;
    }
  }

  /**
   * 用户登录
   */
  async login(data) {
    try {
      const response = await this.callCloudFunction('auth', 'login', data);
      if (response.success && response.data.session_token) {
        this.setSessionToken(response.data.session_token);
      }
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 用户退出登录
   * @returns {Object} 退出结果
   */
  logout() {
    try {
      // 1. 清除 session token
      this.clearSessionToken();
      
      // 2. 清除全局数据
      try {
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.userInfo = null;
          app.globalData.sessionToken = null;
        }
      } catch (e) {
        console.log('清除全局数据失败:', e);
      }
      
      console.log('[Logout] 退出登录成功');
      
      return {
        success: true,
        message: '退出登录成功'
      };
    } catch (error) {
      console.error('[Logout] 错误:', error);
      return {
        success: false,
        error: error.message || '退出登录失败'
      };
    }
  }

  /**
   * 获取手机号
   * @param {string} code - 微信获取手机号授权返回的code
   */
  async getPhoneNumber(code) {
    // 确保传递正确的参数格式给云函数
    return this.callCloudFunction('auth', 'getPhoneNumber', { code });
  }

  /**
   * 获取用户信息
   */
  async getUserInfo() {
    return this.callCloudFunction('auth', 'getUserInfo', {});
  }

  // ========== 活动相关 ==========

  /**
   * 创建活动
   */
  async createActivity(data) {
    return this.callCloudFunction('activities', 'create', data);
  }

  /**
   * 创建活动（简化版）
   * @param {Object} data - 活动数据
   * @returns {Promise} 创建结果
   */
  async createActivity(data) {
    return this.callCloudFunction('activities', 'create', data);
  }

  /**
   * 获取活动列表
   */
  async getActivities(options = {}) {
    return this.callCloudFunction('activities', 'getList', options);
  }

  /**
   * 获取公开活动列表
   */
  async getPublicActivities(options = {}) {
    return this.callCloudFunction('activities', 'getPublicList', options);
  }

  /**
   * 获取活动详情
   */
  async getActivityDetail(activityId) {
    return this.callCloudFunction('activities', 'getDetail', { activity_id: activityId });
  }

  /**
   * 获取公开活动详情（通过链接）
   */
  async getPublicActivityDetail(linkId) {
    return this.callCloudFunction('activities', 'getPublicDetail', { link_id: linkId });
  }

  /**
   * 更新活动
   */
  async updateActivity(activityId, data) {
    return this.callCloudFunction('activities', 'update', {
      activity_id: activityId,
      ...data
    });
  }

  /**
   * 取消活动
   */
  async cancelActivity(activityId) {
    return this.callCloudFunction('activities', 'cancel', { activity_id: activityId });
  }

  // ========== 物品相关 ==========

  /**
   * 上传物品照片
   * @param {Array<string>} filePaths - 本地文件路径数组
   */
  async uploadItemPhotos(filePaths) {
    // 先上传到云存储，然后调用云函数
    const cloudFiles = await this.uploadFilesToCloud(filePaths, 'items/');
    return this.callCloudFunction('items', 'processPhotos', { files: cloudFiles });
  }

  /**
   * 处理物品（AI识别和运费计算）
   * @param {Array<string>} filePaths - 本地文件路径数组
   */
  async processItems(filePaths) {
    // 先上传到云存储
    const cloudFiles = await this.uploadFilesToCloud(filePaths, 'items/');
    // 调用云函数处理
    return this.callCloudFunction('items', 'processPhotos', { files: cloudFiles });
  }

  /**
   * 更新物品信息
   */
  async updateItem(itemId, data) {
    return this.callCloudFunction('items', 'update', {
      item_id: itemId,
      ...data
    });
  }

  // ========== 订单相关 ==========

  /**
   * 创建订单
   */
  async createOrder(data) {
    return this.callCloudFunction('orders', 'create', data);
  }

  /**
   * 获取订单列表
   */
  async getOrders(options = {}) {
    return this.callCloudFunction('orders', 'getList', options);
  }

  /**
   * 获取订单详情
   */
  async getOrderDetail(orderId) {
    return this.callCloudFunction('orders', 'getDetail', { order_id: orderId });
  }

  /**
   * 更新订单状态
   */
  async updateOrderStatus(orderId, status) {
    return this.callCloudFunction('orders', 'updateStatus', {
      order_id: orderId,
      status
    });
  }

  /**
   * 扫描匹配订单（通过二维码）
   */
  async scanMatchOrder(qrCode) {
    return this.callCloudFunction('orders', 'scanMatch', { qr_code: qrCode });
  }

  // ========== 支付相关 ==========

  /**
   * 创建支付参数
   */
  async createPayment(orderId) {
    return this.callCloudFunction('payments', 'create', { order_id: orderId });
  }

  // ========== 分享相关 ==========

  /**
   * 创建分享帖子
   */
  async createSharingPost(data) {
    return this.callCloudFunction('sharing', 'create', data);
  }

  /**
   * 获取分享帖子列表
   */
  async getSharingPosts(options = {}) {
    return this.callCloudFunction('sharing', 'getList', options);
  }

  // ========== 文件上传 ==========

  /**
   * 上传文件到云存储
   */
  async uploadFileToCloud(filePath, cloudPath) {
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath,
        filePath,
        success: (res) => {
          resolve(res.fileID);
        },
        fail: (err) => {
          console.error('Upload file error:', err);
          reject(new Error(err.errMsg || 'Upload failed'));
        }
      });
    });
  }

  /**
   * 批量上传文件到云存储
   */
  async uploadFilesToCloud(filePaths, basePath = '') {
    const uploadPromises = filePaths.map((filePath, index) => {
      const fileName = `${Date.now()}_${index}${this.getFileExtension(filePath)}`;
      const cloudPath = `${basePath}${fileName}`;
      return this.uploadFileToCloud(filePath, cloudPath);
    });

    try {
      const fileIDs = await Promise.all(uploadPromises);
      return fileIDs;
    } catch (error) {
      console.error('Batch upload error:', error);
      throw error;
    }
  }

  /**
   * 获取文件临时链接
   */
  async getTempFileURL(fileID) {
    return new Promise((resolve, reject) => {
      wx.cloud.getTempFileURL({
        fileList: [fileID],
        success: (res) => {
          if (res.fileList && res.fileList.length > 0) {
            resolve(res.fileList[0].tempFileURL);
          } else {
            reject(new Error('Failed to get temp URL'));
          }
        },
        fail: reject
      });
    });
  }

  /**
   * 获取文件扩展名
   */
  getFileExtension(filePath) {
    const match = filePath.match(/\.([^.]+)$/);
    return match ? `.${match[1]}` : '';
  }
}

// 创建单例
const cloudApiService = new CloudApiService();

module.exports = {
  default: cloudApiService
};

