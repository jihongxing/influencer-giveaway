// 云函数环境变量配置
// 这些配置需要在腾讯云开发控制台的云函数环境变量中设置

module.exports = {
  // 微信小程序配置
  wechat: {
    appId: process.env.WECHAT_APPID || 'wx28fe6d19a46e6327',
    secret: process.env.WECHAT_SECRET || '789b87feaa1bc64f42489529d64b04d6'
  },

  // 百度AI配置
  baiduAI: {
    apiKey: process.env.BAIDU_API_KEY || 'Ynk0D3FhSZO5UVxcLrMMO60R',
    secretKey: process.env.BAIDU_SECRET_KEY || 'bTHzNmCKAVE8dKSFGH2HNHg3A4sHCEMA',
    // 百度AI通用物体和场景识别API
    imageRecognitionUrl: 'https://aip.baidubce.com/rest/2.0/image-classify/v2/advanced_general'
  },

  // 快递100配置（推荐方案）
  kuaidi100: {
    key: process.env.KUAIDI100_KEY || 'EZWROLVn8912',
    secret: process.env.KUAIDI100_SECRET || 'b18729a888c54001b9d9f9a7aa6cbce7',
    // 快递100 API地址
    queryUrl: 'https://poll.kuaidi100.com/poll/query.do',
    priceUrl: 'https://poll.kuaidi100.com/price/query.do',
    orderUrl: 'https://poll.kuaidi100.com/printapi/printtask.do'
  },

  // 快递鸟配置（备选方案）
  kdn: {
    eBusinessId: process.env.KDN_EBUSINESS_ID || '1901915',
    apiKey: process.env.KDN_API_KEY || '633e5647-b75c-4143-a874-1e0f76627ba0',
    requestUrl: 'http://api.kdniao.com/Ebusiness/EbusinessOrderHandle.aspx'
  },

  // 环境配置
  env: {
    nodeEnv: process.env.NODE_ENV || 'development',
    useMockExpress: process.env.USE_MOCK_EXPRESS === 'true' || false
  }
};
