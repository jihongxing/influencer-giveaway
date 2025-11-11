// pages/payment/payment.js
const apiService = require('../../services/api-cloud').default;
const AppConfig = require('../../config/app-config');

Page({
  data: {
    orderInfo: {},
    paymentMethod: 'offline', // 默认线下支付
    enableWechatPay: false,
    receiverQRCode: '',
    receiverInfo: {},
    paymentProof: '',
    paying: false,
    canPay: false
  },

  onLoad(options) {
    const orderId = options.orderId;
    if (!orderId) {
      wx.showToast({
        title: '订单不存在',
        icon: 'none'
      });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    // 检查是否支持微信支付
    const enableWechatPay = AppConfig.features.wechatPay;
    
    this.setData({
      orderId,
      enableWechatPay,
      paymentMethod: enableWechatPay ? 'wechat' : 'offline'
    });

    this.loadOrderInfo();
  },

  /**
   * 加载订单信息
   */
  async loadOrderInfo() {
    wx.showLoading({ title: '加载中...' });

    try {
      const response = await apiService.callCloudFunction('orders', 'getOrderDetail', {
        order_id: this.data.orderId
      });

      if (response.success) {
        const orderInfo = response.data;
        
        // 获取收款信息（主播的收款码或账号）
        let receiverInfo = {};
        let receiverQRCode = '';
        
        if (orderInfo.influencer_payment_qrcode) {
          receiverQRCode = orderInfo.influencer_payment_qrcode;
        } else if (orderInfo.influencer_payment_info) {
          receiverInfo = orderInfo.influencer_payment_info;
        }

        this.setData({
          orderInfo,
          receiverQRCode,
          receiverInfo,
          canPay: this.checkCanPay()
        });
      } else {
        throw new Error(response.error?.message || '加载订单失败');
      }
    } catch (error) {
      console.error('Load order error:', error);
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 选择支付方式
   */
  onSelectMethod(e) {
    const method = e.currentTarget.dataset.method;
    this.setData({
      paymentMethod: method,
      canPay: this.checkCanPay()
    });
  },

  /**
   * 上传支付凭证
   */
  onUploadProof() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0];
        
        wx.showLoading({ title: '上传中...' });
        
        try {
          // 上传到云存储
          const fileName = `payment-proofs/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
          const uploadResult = await wx.cloud.uploadFile({
            cloudPath: fileName,
            filePath: tempFilePath
          });

          this.setData({
            paymentProof: uploadResult.fileID,
            canPay: this.checkCanPay()
          });

          wx.showToast({
            title: '上传成功',
            icon: 'success'
          });
        } catch (error) {
          console.error('Upload proof error:', error);
          wx.showToast({
            title: '上传失败',
            icon: 'none'
          });
        } finally {
          wx.hideLoading();
        }
      }
    });
  },

  /**
   * 检查是否可以支付
   */
  checkCanPay() {
    const { paymentMethod, paymentProof } = this.data;
    
    if (paymentMethod === 'wechat') {
      return true; // 微信支付直接可以
    } else {
      return !!paymentProof; // 线下支付需要上传凭证
    }
  },

  /**
   * 确认支付
   */
  async onConfirmPay() {
    const { paymentMethod, orderId, paymentProof } = this.data;

    this.setData({ paying: true });

    try {
      if (paymentMethod === 'wechat') {
        // 微信支付流程
        await this.processWechatPay();
      } else {
        // 线下支付流程
        await this.processOfflinePay(paymentProof);
      }
    } catch (error) {
      console.error('Payment error:', error);
      wx.showToast({
        title: error.message || '支付失败',
        icon: 'none'
      });
      this.setData({ paying: false });
    }
  },

  /**
   * 微信支付处理
   */
  async processWechatPay() {
    const response = await apiService.callCloudFunction('payments', 'unifiedOrder', {
      order_id: this.data.orderId
    });

    if (response.success) {
      // 调起微信支付
      wx.requestPayment({
        timeStamp: response.data.timeStamp,
        nonceStr: response.data.nonceStr,
        package: response.data.package,
        signType: response.data.signType,
        paySign: response.data.paySign,
        success: () => {
          wx.showToast({
            title: '支付成功',
            icon: 'success'
          });
          setTimeout(() => {
            wx.redirectTo({
              url: `/pages/order-detail/order-detail?id=${this.data.orderId}`
            });
          }, 1500);
        },
        fail: (err) => {
          if (err.errMsg.includes('cancel')) {
            wx.showToast({
              title: '支付已取消',
              icon: 'none'
            });
          } else {
            wx.showToast({
              title: '支付失败',
              icon: 'none'
            });
          }
          this.setData({ paying: false });
        }
      });
    } else {
      throw new Error(response.error?.message || '发起支付失败');
    }
  },

  /**
   * 线下支付处理
   */
  async processOfflinePay(proofFileId) {
    const response = await apiService.callCloudFunction('payments', 'submitOfflinePayment', {
      order_id: this.data.orderId,
      payment_proof: proofFileId,
      payment_method: 'offline'
    });

    if (response.success) {
      wx.showToast({
        title: '提交成功，等待审核',
        icon: 'success'
      });
      
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/order-detail/order-detail?id=${this.data.orderId}`
        });
      }, 1500);
    } else {
      throw new Error(response.error?.message || '提交失败');
    }
  },

  /**
   * 取消支付
   */
  onCancel() {
    wx.navigateBack();
  }
});
