// pages/claim-item/claim-item.js
const apiService = require('../../services/api-cloud').default;
const { validateShippingAddress, validateContactName, validatePhoneNumber } = require('../../utils/validation.js');

Page({
  data: {
    itemId: null,
    activityId: null,
    item: null,
    quantity: 1,  // 默认数量
    maxQuantity: 2,  // 最大数量限制
    shippingAddress: {
      province: '',
      city: '',
      district: '',
      street: '',
      postal_code: '',
    },
    shippingContactName: '',
    shippingContactPhone: '',
    loading: true,
    submitting: false,
    addressLoaded: false,  // 是否已加载地址
    // 费用明细
    baseShippingCost: 0,
    packagingFee: 0,
    totalShippingCost: 0,
    platformFee: 0,
    totalAmount: 0,
  },

  onLoad(options) {
    const itemId = options.item_id;  // 保持字符串格式，不要 parseInt
    const activityId = options.activity_id;  // 保持字符串格式

    console.log('[Claim Item] onLoad 参数:', { itemId, activityId });

    if (!itemId) {
      wx.showToast({
        title: '缺少物品ID',
        icon: 'none',
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    if (!activityId) {
      wx.showToast({
        title: '缺少活动ID',
        icon: 'none',
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    this.setData({
      itemId,
      activityId,
    });

    this.loadItemData();
    this.tryLoadUserAddress();  // 自动尝试加载用户地址
  },

  async loadItemData() {
    this.setData({ loading: true });

    try {
      console.log('[Claim Item] 加载活动数据:', { activityId: this.data.activityId });
      
      // 加载活动数据获取物品信息
      const response = await apiService.getActivityDetail(this.data.activityId);

      console.log('[Claim Item] 活动数据响应:', response);

      if (response.success && response.data) {
        const item = response.data.items.find((i) => i.item_id === this.data.itemId);
        
        console.log('[Claim Item] 查找物品:', {
          targetItemId: this.data.itemId,
          totalItems: response.data.items.length,
          foundItem: item,
          allItemIds: response.data.items.map(i => i.item_id)
        });
        
        if (item) {
          // 计算可领取最大数量
          const maxQty = Math.min(2, item.remaining_quantity || 1);
          
          this.setData({
            item,
            maxQuantity: maxQty,
            quantity: Math.min(1, maxQty),
            loading: false,
          });
          
          // 计算费用
          this.calculateCost();
        } else {
          throw new Error('物品不存在');
        }
      } else {
        throw new Error(response.error?.message || '加载物品失败');
      }
    } catch (error) {
      console.error('[Claim Item] 加载失败:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none',
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 计算费用
  calculateCost() {
    const { item, quantity } = this.data;
    if (!item) return;

    const baseShippingCost = item.base_shipping_cost || 10.0;
    const packagingFee = 2.0 * quantity;
    const totalShippingCost = baseShippingCost + packagingFee;
    const platformFee = Math.max(0, totalShippingCost * 0.1);
    const totalAmount = totalShippingCost + platformFee;

    this.setData({
      baseShippingCost: baseShippingCost.toFixed(2),
      packagingFee: packagingFee.toFixed(2),
      totalShippingCost: totalShippingCost.toFixed(2),
      platformFee: platformFee.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
    });
  },

  // 增加数量
  onIncreaseQuantity() {
    const { quantity, maxQuantity } = this.data;
    if (quantity < maxQuantity) {
      this.setData({ quantity: quantity + 1 });
      this.calculateCost();
    } else {
      wx.showToast({
        title: `最多只能领取${maxQuantity}件`,
        icon: 'none',
      });
    }
  },

  // 减少数量
  onDecreaseQuantity() {
    const { quantity } = this.data;
    if (quantity > 1) {
      this.setData({ quantity: quantity - 1 });
      this.calculateCost();
    }
  },

  onRegionChange(e) {
    const [province, city, district] = e.detail.value;
    this.setData({
      'shippingAddress.province': province,
      'shippingAddress.city': city,
      'shippingAddress.district': district,
    });
  },

  onStreetInput(e) {
    this.setData({
      'shippingAddress.street': e.detail.value,
    });
  },

  onPostalCodeInput(e) {
    this.setData({
      'shippingAddress.postal_code': e.detail.value,
    });
  },

  onContactNameInput(e) {
    this.setData({
      shippingContactName: e.detail.value,
    });
  },

  onContactPhoneInput(e) {
    this.setData({
      shippingContactPhone: e.detail.value,
    });
  },

  /**
   * 自动尝试加载用户地址（静默加载）
   */
  async tryLoadUserAddress() {
    try {
      const sessionToken = wx.getStorageSync('sessionToken');
      if (!sessionToken) {
        return;  // 未登录，静默跳过
      }

      const response = await apiService.getUserInfo();
      if (response.success && response.data) {
        const userData = response.data;
        
        // 检查是否有完整的地址信息
        if (userData.shipping_address && 
            userData.shipping_address.province && 
            userData.shipping_address.city && 
            userData.shipping_address.district && 
            userData.shipping_address.street) {
          
          this.setData({
            shippingAddress: {
              province: userData.shipping_address.province,
              city: userData.shipping_address.city,
              district: userData.shipping_address.district,
              street: userData.shipping_address.street,
              postal_code: userData.shipping_address.postal_code || userData.shipping_address.postalCode || '',
            },
            shippingContactName: userData.shipping_contact_name || '',
            shippingContactPhone: userData.shipping_contact_phone || '',
            addressLoaded: true
          });

          console.log('[Claim Item] 自动加载用户地址成功');
        }
      }
    } catch (error) {
      // 静默失败，不显示错误
      console.log('[Claim Item] 自动加载地址失败:', error);
    }
  },

  /**
   * 手动点击加载用户地址
   */
  async onLoadUserAddress() {
    try {
      wx.showLoading({ title: '加载中...' });

      const sessionToken = wx.getStorageSync('sessionToken');
      if (!sessionToken) {
        wx.hideLoading();
        wx.showModal({
          title: '提示',
          content: '请先登录才能读取地址',
          showCancel: false
        });
        return;
      }

      const response = await apiService.getUserInfo();
      
      if (response.success && response.data) {
        const userData = response.data;
        
        // 检查是否有地址信息
        if (!userData.shipping_address || 
            !userData.shipping_address.province || 
            !userData.shipping_address.city) {
          wx.hideLoading();
          wx.showModal({
            title: '提示',
            content: '您还没有设置收货地址，是否现在去设置？',
            success: (res) => {
              if (res.confirm) {
                wx.navigateTo({
                  url: '/pages/profile/profile'
                });
              }
            }
          });
          return;
        }

        // 加载地址
        this.setData({
          shippingAddress: {
            province: userData.shipping_address.province,
            city: userData.shipping_address.city,
            district: userData.shipping_address.district,
            street: userData.shipping_address.street,
            postal_code: userData.shipping_address.postal_code || userData.shipping_address.postalCode || '',
          },
          shippingContactName: userData.shipping_contact_name || '',
          shippingContactPhone: userData.shipping_contact_phone || '',
          addressLoaded: true
        });

        wx.hideLoading();
        wx.showToast({
          title: '地址加载成功',
          icon: 'success',
          duration: 1500
        });
      } else {
        throw new Error(response.error?.message || '加载失败');
      }
    } catch (error) {
      console.error('[Claim Item] 加载用户地址失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  validateForm() {
    // Validate shipping address
    const addressValidation = validateShippingAddress(this.data.shippingAddress);
    if (!addressValidation.valid) {
      wx.showToast({
        title: addressValidation.message || '地址格式不正确',
        icon: 'none',
      });
      return false;
    }

    // Validate contact name
    const nameValidation = validateContactName(this.data.shippingContactName);
    if (!nameValidation.valid) {
      wx.showToast({
        title: nameValidation.message || '联系人姓名不正确',
        icon: 'none',
      });
      return false;
    }

    // Validate contact phone
    if (!validatePhoneNumber(this.data.shippingContactPhone)) {
      wx.showToast({
        title: '请输入正确的联系人手机号',
        icon: 'none',
      });
      return false;
    }

    return true;
  },

  async onSubmit() {
    if (this.data.submitting) {
      return;
    }

    if (!this.validateForm()) {
      return;
    }

    this.setData({ submitting: true });

    wx.showLoading({
      title: '处理中...',
    });

    try {
      // 调用新的多物品订单接口
      const result = await wx.cloud.callFunction({
        name: 'orders',
        data: {
          action: 'createMultiItem',
          data: {
            items: [
              {
                item_id: this.data.itemId,
                quantity: this.data.quantity
              }
            ],
            fan_phone_number: wx.getStorageSync('user_phone') || '13800138000',
            shipping_address: this.data.shippingAddress,
            shipping_contact_name: this.data.shippingContactName,
            shipping_contact_phone: this.data.shippingContactPhone
          }
        }
      });

      wx.hideLoading();

      if (result.result.success) {
        wx.showToast({
          title: '订单创建成功',
          icon: 'success',
        });

        // 跳转到支付页面
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/payment/payment?order_id=${result.result.data.order_id}`,
          });
        }, 1500);
      } else {
        throw new Error(result.result.error.message || '创建订单失败');
      }
    } catch (error) {
      console.error('Claim item error:', error);
      wx.hideLoading();
      wx.showToast({
        title: error.message || '领取失败',
        icon: 'none',
      });
      this.setData({ submitting: false });
    }
  },
});

