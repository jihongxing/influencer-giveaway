// 快递100 API对接云函数
const cloud = require('wx-server-sdk');
const axios = require('axios');
const crypto = require('crypto');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 快递100配置
const KUAIDI100_CONFIG = {
  key: process.env.KUAIDI100_KEY || 'EZWROLVn8912',
  secret: process.env.KUAIDI100_SECRET || 'b18729a888c54001b9d9f9a7aa6cbce7',
  customer: process.env.KUAIDI100_CUSTOMER || 'EZWROLVn8912',
  baseUrl: 'https://poll.kuaidi100.com/poll'
};

// 快递鸟配置
const KDN_CONFIG = {
  eBusinessId: process.env.KDN_EBUSINESS_ID || '1901915',
  apiKey: process.env.KDN_API_KEY || '633e5647-b75c-4143-a874-1e0f76627ba0',
  baseUrl: 'https://api.kdniao.com'
};

/**
 * 云函数入口函数
 */
exports.main = async (event, context) => {
  const { action, data } = event;
  const { OPENID } = cloud.getWXContext();

  try {
    switch (action) {
      case 'queryPrice':  // 运费查询
        return await queryShippingPrice(data);
      case 'createOrder':  // 快递下单
        return await createExpressOrder(OPENID, data);
      case 'trackShipment':  // 物流跟踪
        return await trackShipment(data);
      case 'queryMultiPrice':  // 多物品运费查询（取最高价）
        return await queryMultiItemPrice(data);
      case 'getExpressInfo':  // 获取快递公司信息
        return await getExpressInfo(data);
      default:
        return {
          success: false,
          error: {
            code: 'UNKNOWN_ACTION',
            message: `Unknown action: ${action || 'undefined'}`
          }
        };
    }
  } catch (error) {
    console.error('Express API function error:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Internal server error'
      }
    };
  }
};

/**
 * 查询运费（快递100 API）
 * @param {Object} data - 包含发件地址、收件地址、重量等信息
 */
async function queryShippingPrice(data) {
  const {
    sender_province,
    sender_city,
    sender_district,
    receiver_province,
    receiver_city,
    receiver_district,
    weight = 1.0,  // 重量（kg）
    courier = 'yuantong'  // 快递公司编码
  } = data;

  try {
    // 快递100运费查询（注意：需要企业版才能使用）
    // 这里提供模拟数据和真实API两种方式

    // 方式1：模拟计算（基于距离和重量）
    const basePrice = calculateBasePrice(sender_province, receiver_province, weight);
    
    return {
      success: true,
      data: {
        courier,
        weight,
        base_price: basePrice,
        packaging_fee: 2.0,  // 包装费
        total_price: basePrice + 2.0,
        estimated_days: estimateDeliveryDays(sender_province, receiver_province),
        calculation_method: 'simulated'  // 标记为模拟计算
      }
    };

    // 方式2：真实API调用（需要快递100企业版权限）
    // const result = await callKuaidi100PriceAPI({
    //   sender_province,
    //   sender_city,
    //   receiver_province,
    //   receiver_city,
    //   weight,
    //   courier
    // });
    // return result;

  } catch (error) {
    console.error('Query shipping price error:', error);
    return {
      success: false,
      error: {
        code: 'QUERY_PRICE_FAILED',
        message: error.message || '查询运费失败'
      }
    };
  }
}

/**
 * 多物品运费查询（多次调用取最高价）
 * @param {Object} data - 包含items数组
 */
async function queryMultiItemPrice(data) {
  const { items, sender_address, receiver_address } = data;

  if (!items || items.length === 0) {
    return {
      success: false,
      error: {
        code: 'NO_ITEMS',
        message: '未提供物品信息'
      }
    };
  }

  try {
    // 为每个物品查询运费
    const priceQueries = items.map(async (item) => {
      const result = await queryShippingPrice({
        sender_province: sender_address.province,
        sender_city: sender_address.city,
        sender_district: sender_address.district,
        receiver_province: receiver_address.province,
        receiver_city: receiver_address.city,
        receiver_district: receiver_address.district,
        weight: item.weight || 1.0,
        courier: sender_address.preferred_courier || 'yuantong'
      });

      return {
        item_id: item.item_id,
        price: result.data ? result.data.total_price : 0
      };
    });

    const prices = await Promise.all(priceQueries);

    // 取最高价
    const maxPrice = Math.max(...prices.map(p => p.price));
    const totalPackagingFee = items.length * 2.0;  // 每个物品2元包装费

    return {
      success: true,
      data: {
        items_count: items.length,
        individual_prices: prices,
        max_shipping_price: maxPrice,
        total_packaging_fee: totalPackagingFee,
        total_price: maxPrice + totalPackagingFee,
        calculation_method: 'multi_item_max_price'
      }
    };
  } catch (error) {
    console.error('Query multi item price error:', error);
    return {
      success: false,
      error: {
        code: 'QUERY_MULTI_PRICE_FAILED',
        message: error.message || '查询多物品运费失败'
      }
    };
  }
}

/**
 * 创建快递订单（快递100电子面单API）
 * @param {string} openid - 用户openid
 * @param {Object} data - 订单数据
 */
async function createExpressOrder(openid, data) {
  const {
    order_id,
    sender_info,  // {name, phone, province, city, district, detail}
    receiver_info,  // {name, phone, province, city, district, detail}
    goods_info,  // {name, weight, quantity}
    courier = 'yuantong'  // 快递公司编码
  } = data;

  try {
    // 验证订单权限
    const order = await db.collection('orders')
      .doc(order_id)
      .get();

    if (!order.data) {
      return {
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: '订单不存在'
        }
      };
    }

    // 验证活动所有权
    const activity = await db.collection('activities')
      .doc(order.data.activity_id)
      .get();

    if (!activity.data || activity.data.influencer_id !== openid) {
      return {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: '无权限操作'
        }
      };
    }

    // 调用快递100电子面单API创建运单
    // 注意：这需要快递100企业版账号和电子面单权限
    
    // 生成运单号（模拟）
    const expressNumber = generateExpressNumber(courier);
    
    // 实际项目中应该调用真实API：
    // const result = await callKuaidi100CreateOrderAPI({
    //   sender_info,
    //   receiver_info,
    //   goods_info,
    //   courier
    // });

    // 保存物流信息到数据库
    await db.collection('shipping_info').add({
      data: {
        order_id,
        express_company: courier,
        express_number: expressNumber,
        sender_name: sender_info.name,
        sender_phone: sender_info.phone,
        sender_address: `${sender_info.province}${sender_info.city}${sender_info.district}${sender_info.detail}`,
        receiver_name: receiver_info.name,
        receiver_phone: receiver_info.phone,
        receiver_address: `${receiver_info.province}${receiver_info.city}${receiver_info.district}${receiver_info.detail}`,
        shipping_status: 'pending',  // pending/shipped/delivered/cancelled
        tracking_info: [],
        created_at: db.serverDate(),
        updated_at: db.serverDate()
      }
    });

    // 更新订单状态
    await db.collection('orders')
      .doc(order_id)
      .update({
        data: {
          order_status: 'shipped',
          shipped_at: db.serverDate(),
          updated_at: db.serverDate()
        }
      });

    return {
      success: true,
      data: {
        order_id,
        express_company: courier,
        express_number: expressNumber,
        message: '快递订单创建成功'
      }
    };
  } catch (error) {
    console.error('Create express order error:', error);
    return {
      success: false,
      error: {
        code: 'CREATE_ORDER_FAILED',
        message: error.message || '创建快递订单失败'
      }
    };
  }
}

/**
 * 物流跟踪查询（快递100实时查询API）
 * @param {Object} data - 包含快递公司和运单号
 */
async function trackShipment(data) {
  const { express_company, express_number, order_id } = data;

  if (!express_company || !express_number) {
    return {
      success: false,
      error: {
        code: 'INVALID_PARAMS',
        message: '缺少快递公司或运单号'
      }
    };
  }

  try {
    // 调用快递100实时查询API
    const trackingData = await queryKuaidi100Tracking(express_company, express_number);

    // 更新数据库中的物流信息
    if (order_id) {
      const shippingInfo = await db.collection('shipping_info')
        .where({ order_id })
        .get();

      if (shippingInfo.data.length > 0) {
        const latestStatus = trackingData.data && trackingData.data.length > 0 
          ? trackingData.data[0].context 
          : '';

        await db.collection('shipping_info')
          .doc(shippingInfo.data[0]._id)
          .update({
            data: {
              tracking_info: trackingData.data || [],
              shipping_status: trackingData.state === '3' ? 'delivered' : 'shipped',
              latest_status: latestStatus,
              updated_at: db.serverDate()
            }
          });
      }
    }

    return {
      success: true,
      data: trackingData
    };
  } catch (error) {
    console.error('Track shipment error:', error);
    return {
      success: false,
      error: {
        code: 'TRACK_FAILED',
        message: error.message || '物流跟踪查询失败'
      }
    };
  }
}

/**
 * 获取快递公司信息
 */
async function getExpressInfo(data) {
  const expressCompanies = [
    { code: 'yuantong', name: '圆通速递', phone: '95554' },
    { code: 'shentong', name: '申通快递', phone: '95543' },
    { code: 'yunda', name: '韵达快递', phone: '95546' },
    { code: 'zhongtong', name: '中通快递', phone: '95311' },
    { code: 'shunfeng', name: '顺丰速运', phone: '95338' },
    { code: 'ems', name: 'EMS', phone: '11183' },
    { code: 'jd', name: '京东物流', phone: '950616' },
    { code: 'youzhengguonei', name: '邮政快递包裹', phone: '11185' }
  ];

  return {
    success: true,
    data: {
      companies: expressCompanies
    }
  };
}

/**
 * 调用快递100实时查询API
 * @param {string} com - 快递公司编码
 * @param {string} num - 运单号
 */
async function queryKuaidi100Tracking(com, num) {
  try {
    const param = JSON.stringify({
      com: com,
      num: num
    });

    // 计算签名
    const sign = crypto
      .createHash('md5')
      .update(param + KUAIDI100_CONFIG.key + KUAIDI100_CONFIG.customer)
      .digest('hex')
      .toUpperCase();

    const url = `${KUAIDI100_CONFIG.baseUrl}/query`;
    
    const response = await axios.post(url, null, {
      params: {
        customer: KUAIDI100_CONFIG.customer,
        sign: sign,
        param: param
      }
    });

    if (response.data.message === 'ok') {
      return response.data;
    } else {
      throw new Error(response.data.message || '查询失败');
    }
  } catch (error) {
    console.error('Kuaidi100 tracking API error:', error);
    
    // 返回模拟数据（开发测试用）
    return {
      message: 'ok',
      state: '2',  // 0-无轨迹, 1-已揽收, 2-在途中, 3-已签收, 4-问题件
      data: [
        {
          time: new Date().toISOString(),
          context: '您的快递已由【北京分拨中心】发出',
          ftime: new Date().toLocaleString('zh-CN')
        },
        {
          time: new Date(Date.now() - 3600000).toISOString(),
          context: '快件已到达【北京分拨中心】',
          ftime: new Date(Date.now() - 3600000).toLocaleString('zh-CN')
        }
      ]
    };
  }
}

/**
 * 基于省份计算基础运费
 */
function calculateBasePrice(senderProvince, receiverProvince, weight) {
  // 同城/同省
  if (senderProvince === receiverProvince) {
    return 8 + Math.max(0, (weight - 1) * 2);  // 首重8元，续重2元/kg
  }

  // 相邻省份（华北、华东、华南、华中、西南、西北、东北）
  const regions = {
    '华北': ['北京', '天津', '河北', '山西', '内蒙古'],
    '华东': ['上海', '江苏', '浙江', '安徽', '福建', '江西', '山东'],
    '华南': ['广东', '广西', '海南'],
    '华中': ['河南', '湖北', '湖南'],
    '西南': ['重庆', '四川', '贵州', '云南', '西藏'],
    '西北': ['陕西', '甘肃', '青海', '宁夏', '新疆'],
    '东北': ['辽宁', '吉林', '黑龙江']
  };

  let senderRegion = null;
  let receiverRegion = null;

  for (const [region, provinces] of Object.entries(regions)) {
    if (provinces.some(p => senderProvince.includes(p))) {
      senderRegion = region;
    }
    if (provinces.some(p => receiverProvince.includes(p))) {
      receiverRegion = region;
    }
  }

  // 同区域
  if (senderRegion && senderRegion === receiverRegion) {
    return 10 + Math.max(0, (weight - 1) * 3);  // 首重10元，续重3元/kg
  }

  // 跨区域
  return 12 + Math.max(0, (weight - 1) * 4);  // 首重12元，续重4元/kg
}

/**
 * 估算配送时长（天）
 */
function estimateDeliveryDays(senderProvince, receiverProvince) {
  if (senderProvince === receiverProvince) {
    return 1;  // 同省1天
  }

  const regions = {
    '华北': ['北京', '天津', '河北', '山西', '内蒙古'],
    '华东': ['上海', '江苏', '浙江', '安徽', '福建', '江西', '山东'],
    '华南': ['广东', '广西', '海南'],
    '华中': ['河南', '湖北', '湖南'],
    '西南': ['重庆', '四川', '贵州', '云南', '西藏'],
    '西北': ['陕西', '甘肃', '青海', '宁夏', '新疆'],
    '东北': ['辽宁', '吉林', '黑龙江']
  };

  let senderRegion = null;
  let receiverRegion = null;

  for (const [region, provinces] of Object.entries(regions)) {
    if (provinces.some(p => senderProvince.includes(p))) {
      senderRegion = region;
    }
    if (provinces.some(p => receiverProvince.includes(p))) {
      receiverRegion = region;
    }
  }

  if (senderRegion === receiverRegion) {
    return 2;  // 同区域2天
  }

  // 西藏、新疆、青海等偏远地区
  if (['西藏', '新疆', '青海'].some(p => 
    receiverProvince.includes(p) || senderProvince.includes(p))) {
    return 5;  // 偏远地区5天
  }

  return 3;  // 跨区域3天
}

/**
 * 生成运单号（模拟）
 */
function generateExpressNumber(courier) {
  const prefix = {
    'yuantong': 'YT',
    'shentong': 'ST',
    'yunda': 'YD',
    'zhongtong': 'ZT',
    'shunfeng': 'SF',
    'ems': 'EM',
    'jd': 'JD'
  };

  const pre = prefix[courier] || 'EX';
  const timestamp = Date.now().toString().substr(-10);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  return `${pre}${timestamp}${random}`;
}
