// pages/create-activity-info/create-activity-info.js
Page({
  data: {
    // 表单数据
    formData: {
      title: '',
      description: '',
      cover_image_url: '',
      source_platform: 'other',
      scheduled_start_time: '',
      is_immediate_publish: true,
      is_password_protected: false,
      access_password: '',
      password_hint: '',
      preferred_courier: '',
      sender_address: null,
      sender_contact_name: '',
      sender_contact_phone: ''
    },

    // 平台选项
    platformOptions: [
      { value: 'douyin', label: '抖音' },
      { value: 'xiaohongshu', label: '小红书' },
      { value: 'wechat', label: '微信' },
      { value: 'other', label: '其他' }
    ],

    // 快递选项
    courierOptions: [
      { value: '', label: '不指定' },
      { value: 'shunfeng', label: '顺丰速运' },
      { value: 'yuantong', label: '圆通速递' },
      { value: 'zhongtong', label: '中通快递' },
      { value: 'yunda', label: '韵达快递' }
    ],

    // UI状态
    showPasswordInput: false,
    showScheduleInput: false,
    loading: false,

    // 日期时间相关
    scheduledDate: '',
    scheduledTimeIndex: 0,
    minDate: '',
    timeOptions: [
      '00:00', '00:30', '01:00', '01:30', '02:00', '02:30',
      '03:00', '03:30', '04:00', '04:30', '05:00', '05:30',
      '06:00', '06:30', '07:00', '07:30', '08:00', '08:30',
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
      '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
      '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
      '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'
    ]
  },

  onLoad(options) {
    // 设置最小日期为今天
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const minDate = `${year}-${month}-${day}`;
    
    this.setData({ minDate });

    // 从本地存储读取草稿
    const draft = wx.getStorageSync('activity_draft');
    if (draft) {
      // 如果有预约时间，解析出日期和时间
      let scheduledDate = '';
      let scheduledTimeIndex = 0;
      if (draft.scheduled_start_time) {
        const parts = draft.scheduled_start_time.split(' ');
        if (parts.length === 2) {
          scheduledDate = parts[0];
          const time = parts[1];
          scheduledTimeIndex = this.data.timeOptions.indexOf(time);
          if (scheduledTimeIndex === -1) scheduledTimeIndex = 0;
        }
      }

      this.setData({
        formData: draft,
        showPasswordInput: draft.is_password_protected,
        showScheduleInput: !draft.is_immediate_publish,
        scheduledDate,
        scheduledTimeIndex
      });
    } else {
      // 如果没有草稿，尝试加载上次的发货信息
      this.loadLastSenderInfo();
    }
  },

  // 标题输入
  onTitleInput(e) {
    this.setData({
      'formData.title': e.detail.value
    });
    this.saveDraft();
  },

  // 描述输入
  onDescriptionInput(e) {
    this.setData({
      'formData.description': e.detail.value
    });
    this.saveDraft();
  },

  // 选择平台
  onPlatformChange(e) {
    this.setData({
      'formData.source_platform': e.currentTarget.dataset.value
    });
    this.saveDraft();
  },

  // 选择快递
  onCourierChange(e) {
    this.setData({
      'formData.preferred_courier': e.detail.value
    });
    this.saveDraft();
  },

  // 上传封面
  onChooseCover() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        
        wx.showLoading({ title: '上传中...' });
        
        // 上传到云存储
        const cloudPath = `activity-covers/${Date.now()}-${Math.random().toString(36).substr(2)}.jpg`;
        wx.cloud.uploadFile({
          cloudPath,
          filePath: tempFilePath,
          success: (uploadRes) => {
            this.setData({
              'formData.cover_image_url': uploadRes.fileID
            });
            this.saveDraft();
            wx.hideLoading();
            wx.showToast({ title: '上传成功', icon: 'success' });
          },
          fail: (err) => {
            console.error('上传失败:', err);
            wx.hideLoading();
            wx.showToast({ title: '上传失败', icon: 'none' });
          }
        });
      }
    });
  },

  // 切换立即发布
  onImmediatePublishChange(e) {
    const isImmediate = e.detail.value;
    this.setData({
      'formData.is_immediate_publish': isImmediate,
      showScheduleInput: !isImmediate
    });
    this.saveDraft();
  },

  // 选择开始日期
  onScheduleDateChange(e) {
    const date = e.detail.value;
    this.setData({ scheduledDate: date });
    this.updateScheduledDateTime();
  },

  // 选择开始时间
  onScheduleTimeChange(e) {
    const timeIndex = e.detail.value;
    this.setData({ scheduledTimeIndex: timeIndex });
    this.updateScheduledDateTime();
  },

  // 更新预约时间
  updateScheduledDateTime() {
    const { scheduledDate, scheduledTimeIndex, timeOptions } = this.data;
    if (scheduledDate && timeOptions[scheduledTimeIndex]) {
      const datetime = `${scheduledDate} ${timeOptions[scheduledTimeIndex]}`;
      this.setData({
        'formData.scheduled_start_time': datetime
      });
      this.saveDraft();
    }
  },

  // 切换密码保护
  onPasswordProtectedChange(e) {
    const isProtected = e.detail.value;
    this.setData({
      'formData.is_password_protected': isProtected,
      showPasswordInput: isProtected
    });
    if (!isProtected) {
      this.setData({
        'formData.access_password': '',
        'formData.password_hint': ''
      });
    }
    this.saveDraft();
  },

  // 密码输入
  onPasswordInput(e) {
    this.setData({
      'formData.access_password': e.detail.value
    });
    this.saveDraft();
  },

  // 密码提示输入
  onPasswordHintInput(e) {
    this.setData({
      'formData.password_hint': e.detail.value
    });
    this.saveDraft();
  },

  // 选择发货地址
  onChooseAddress() {
    wx.chooseAddress({
      success: (res) => {
        this.setData({
          'formData.sender_address': {
            province: res.provinceName,
            city: res.cityName,
            district: res.countyName,
            street: res.detailInfo,
            postal_code: res.postalCode
          },
          'formData.sender_contact_name': res.userName,
          'formData.sender_contact_phone': res.telNumber
        });
        this.saveDraft();
      },
      fail: (err) => {
        console.error('选择地址失败:', err);
        if (err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '请授权地址权限', icon: 'none' });
        }
      }
    });
  },

  /**
   * 加载上次的发货信息（自动填充）
   */
  async loadLastSenderInfo() {
    try {
      const sessionToken = wx.getStorageSync('sessionToken');
      if (!sessionToken) {
        return;  // 未登录，跳过
      }

      console.log('[Create Activity] 加载上次发货信息...');

      // 调用云函数获取用户最近的一次活动
      const res = await wx.cloud.callFunction({
        name: 'activities',
        data: {
          action: 'getList',  // 使用 getList 获取用户自己的活动
          data: {
            page: 1,
            limit: 1,
            status: 'all'  // 获取最近一次活动（任意状态）
          }
        }
      });

      console.log('[Create Activity] 云函数响应:', res.result);

      if (res.result.success && res.result.data && res.result.data.length > 0) {
        const lastActivity = res.result.data[0];
        
        // 检查是否有完整的发货信息
        if (lastActivity.sender_address && 
            lastActivity.sender_contact_name && 
            lastActivity.sender_contact_phone) {
          
          console.log('[Create Activity] 找到上次发货信息:', {
            address: lastActivity.sender_address,
            name: lastActivity.sender_contact_name,
            phone: lastActivity.sender_contact_phone
          });

          // 自动填充发货信息
          this.setData({
            'formData.sender_address': lastActivity.sender_address,
            'formData.sender_contact_name': lastActivity.sender_contact_name,
            'formData.sender_contact_phone': lastActivity.sender_contact_phone
          });

          // 显示提示
          wx.showToast({
            title: '已自动填充上次发货信息',
            icon: 'success',
            duration: 2000
          });
        } else {
          console.log('[Create Activity] 上次活动缺少发货信息');
        }
      } else {
        console.log('[Create Activity] 没有找到历史活动');
      }
    } catch (error) {
      // 静默失败，不影响用户体验
      console.error('[Create Activity] 加载上次发货信息失败:', error);
    }
  },

  // 发货人姓名输入
  onContactNameInput(e) {
    this.setData({
      'formData.sender_contact_name': e.detail.value
    });
    this.saveDraft();
  },

  // 发货人电话输入
  onContactPhoneInput(e) {
    this.setData({
      'formData.sender_contact_phone': e.detail.value
    });
    this.saveDraft();
  },

  // 保存草稿
  saveDraft() {
    wx.setStorageSync('activity_draft', this.data.formData);
  },

  // 验证表单
  validateForm() {
    const { formData } = this.data;

    if (!formData.title || formData.title.trim().length === 0) {
      wx.showToast({ title: '请输入活动标题', icon: 'none' });
      return false;
    }

    if (formData.title.length > 50) {
      wx.showToast({ title: '标题不能超过50字', icon: 'none' });
      return false;
    }

    if (formData.description && formData.description.length > 500) {
      wx.showToast({ title: '描述不能超过500字', icon: 'none' });
      return false;
    }

    if (formData.is_password_protected) {
      if (!formData.access_password || !/^[A-Za-z0-9]{4,8}$/.test(formData.access_password)) {
        wx.showToast({ title: '密码需为4-8位字母或数字', icon: 'none' });
        return false;
      }
    }

    if (!formData.sender_address) {
      wx.showToast({ title: '请选择发货地址', icon: 'none' });
      return false;
    }

    if (!formData.sender_contact_name || formData.sender_contact_name.trim().length === 0) {
      wx.showToast({ title: '请输入发货人姓名', icon: 'none' });
      return false;
    }

    // 联系电话非空检查（详细格式验证由云函数完成）
    if (!formData.sender_contact_phone || formData.sender_contact_phone.trim().length === 0) {
      wx.showToast({ title: '请输入发货人联系电话', icon: 'none' });
      return false;
    }

    return true;
  },

  // 下一步：添加物品
  onNextStep() {
    if (!this.validateForm()) {
      return;
    }

    this.setData({ loading: true });

    // 调用云函数创建活动
    wx.cloud.callFunction({
      name: 'activities',
      data: {
        action: 'createWithMetadata',
        data: this.data.formData
      }
    }).then(res => {
      this.setData({ loading: false });

      if (res.result.success) {
        // 清除草稿
        wx.removeStorageSync('activity_draft');

        // 保存活动ID到全局
        const app = getApp();
        app.globalData.currentActivityId = res.result.data.activity_id;

        // 跳转到批量上传物品页面
        wx.navigateTo({
          url: `/pages/batch-upload-items/batch-upload-items?activity_id=${res.result.data.activity_id}`
        });
      } else {
        wx.showToast({
          title: res.result.error.message || '创建失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      this.setData({ loading: false });
      console.error('创建活动失败:', err);
      wx.showToast({ title: '创建失败，请重试', icon: 'none' });
    });
  },

  // 取消
  onCancel() {
    wx.showModal({
      title: '提示',
      content: '确定要放弃创建活动吗？草稿将被保留',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack();
        }
      }
    });
  }
});
