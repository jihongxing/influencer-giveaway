/**
 * 应用配置文件
 * 根据小程序认证类型自动切换功能
 */

const AppConfig = {
  /**
   * 小程序认证类型
   * 'personal' - 个人认证（无支付和手机号获取）
   * 'enterprise' - 企业认证（完整功能）
   */
  certificationType: 'personal', // 修改此处即可切换
  
  /**
   * 功能开关（根据认证类型自动计算）
   */
  get features() {
    const isEnterprise = this.certificationType === 'enterprise';
    
    return {
      // 微信支付功能
      wechatPay: isEnterprise,
      
      // 手机号获取功能
      phoneNumberAuth: isEnterprise,
      
      // 实名认证（企业版可选）
      realNameAuth: isEnterprise,
      
      // 线下支付（个人版启用）
      offlinePayment: !isEnterprise,
      
      // 手动输入手机号（个人版启用）
      manualPhoneInput: !isEnterprise
    };
  },
  
  /**
   * 支付方式配置
   */
  get paymentMethods() {
    if (this.features.wechatPay) {
      return [
        { id: 'wechat', name: '微信支付', enabled: true },
        { id: 'offline', name: '线下支付', enabled: true }
      ];
    } else {
      return [
        { id: 'offline', name: '线下支付', enabled: true }
      ];
    }
  },
  
  /**
   * 线下支付配置
   */
  offlinePayment: {
    // 收款二维码（主播自己的收款码）
    qrCodeEnabled: true,
    
    // 转账凭证上传
    transferProofRequired: true,
    
    // 支付说明
    description: '请通过以下方式支付运费和服务费，支付后上传凭证',
    
    // 审核模式
    needManualReview: true
  },
  
  /**
   * 创建活动配置
   */
  activityCreation: {
    // 是否需要身份证（企业版可选，个人版不需要）
    requireIdCard: false,
    
    // 手机号获取方式
    get phoneNumberMethod() {
      return AppConfig.features.phoneNumberAuth ? 'wechat_auth' : 'manual_input';
    }
  }
};

module.exports = AppConfig;
