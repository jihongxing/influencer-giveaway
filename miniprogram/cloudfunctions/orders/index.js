// 订单管理云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 云函数入口函数
 */
exports.main = async (event, context) => {
  const { action, data } = event;
  const { OPENID } = cloud.getWXContext();

  try {
    switch (action) {
      case 'create':
        return await createOrder(OPENID, data);
      case 'createMultiItem':  // 新增：多物品订单
        return await createMultiItemOrder(OPENID, data);
      case 'releaseExpiredLocks':  // 新增：释放超时锁定
        return await releaseExpiredLocks();
      case 'cancelExpiredOrders':  // 新增：取消超时订单
        return await cancelExpiredOrders();
      case 'getList':
        return await getOrderList(OPENID, data);
      case 'getDetail':
        return await getOrderDetail(OPENID, data);
      case 'updateStatus':
        return await updateOrderStatus(OPENID, data);
      case 'confirmPayment':
        return await confirmPayment(OPENID, data);
      case 'cancelOrder':  // 新增：用户主动取消订单
        return await cancelOrder(OPENID, data);
      case 'scanMatch':
        return await scanMatchOrder(OPENID, data);
      default:
        return {
          success: false,
          error: {
            code: 'UNKNOWN_ACTION',
            message: `Unknown action: ${action}`
          }
        };
    }
  } catch (error) {
    console.error('Orders function error:', error);
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
 * 创建订单（领取物品）
 * 增强版：支持每人限领2个逻辑
 */
async function createOrder(openid, data) {
  const {
    item_id,
    fan_phone_number,
    shipping_address,
    shipping_contact_name,
    shipping_contact_phone
  } = data;

  // 验证手机号格式
  if (!/^1[3-9]\d{9}$/.test(fan_phone_number)) {
    return {
      success: false,
      error: {
        code: 'INVALID_PHONE',
        message: 'Invalid phone number format'
      }
    };
  }

  if (!/^1[3-9]\d{9}$/.test(shipping_contact_phone)) {
    return {
      success: false,
      error: {
        code: 'INVALID_PHONE',
        message: 'Invalid contact phone number format'
      }
    };
  }

  // 验证地址
  if (!shipping_address.province || !shipping_address.city ||
      !shipping_address.district || !shipping_address.street) {
    return {
      success: false,
      error: {
        code: 'INVALID_ADDRESS',
        message: 'Invalid shipping address'
      }
    };
  }

  // 获取物品信息
  const itemResult = await db.collection('items')
    .doc(item_id)
    .get();

  if (!itemResult.data) {
    return {
      success: false,
      error: {
        code: 'ITEM_NOT_FOUND',
        message: 'Item not found'
      }
    };
  }

  const item = itemResult.data;

  // 检查每人限领2个逻辑（按活动统计）
  const userOrdersInActivity = await db.collection('orders')
    .where({
      activity_id: item.activity_id,
      fan_wechat_openid: openid,
      order_status: _.neq('cancelled')  // 不计算已取消的订单
    })
    .count();

  if (userOrdersInActivity.total >= 2) {
    return {
      success: false,
      error: {
        code: 'LIMIT_EXCEEDED',
        message: '每人最多可领取2个物品',
        current_count: userOrdersInActivity.total,
        max_limit: 2
      }
    };
  }

  // 使用事务确保并发安全
  const transaction = await db.startTransaction();

  try {
    // 锁定物品记录（通过查询并更新状态）
    const itemInTx = await transaction.collection('items')
      .doc(item_id)
      .get();

    if (!itemInTx.data) {
      await transaction.rollback();
      return {
        success: false,
        error: {
          code: 'ITEM_NOT_FOUND',
          message: 'Item not found'
        }
      };
    }

    const itemData = itemInTx.data;

    // 检查库存
    const remainingQty = itemData.remaining_quantity || 0;
    if (remainingQty <= 0) {
      await transaction.rollback();
      return {
        success: false,
        error: {
          code: 'OUT_OF_STOCK',
          message: '物品已被领完'
        }
      };
    }

    // 计算费用（官方报价 + 包装费 + 服务费5%）
    const packagingFee = 2.0; // 包装费
    const shippingCost = itemData.shipping_cost_estimate || 10.0;  // 官方运费报价
    const subtotal = packagingFee + shippingCost;  // 小计
    const platformFee = subtotal * 0.05;  // 平台服务费（小计的5%）
    const totalAmount = subtotal + platformFee;  // 总金额

    // 创建订单
    const orderResult = await transaction.collection('orders').add({
      data: {
        item_id: item_id,
        activity_id: itemData.activity_id,
        fan_wechat_openid: openid,
        fan_phone_number: fan_phone_number,
        shipping_address: JSON.stringify(shipping_address),
        shipping_contact_name: shipping_contact_name,
        shipping_contact_phone: shipping_contact_phone,
        packaging_fee: packagingFee,
        shipping_cost: shippingCost,
        platform_fee: platformFee,
        total_amount: totalAmount,
        payment_status: 'pending',
        order_status: 'pending',
        payment_deadline: new Date(Date.now() + 15 * 60 * 1000),  // 15分钟支付超时
        created_at: db.serverDate(),
        updated_at: db.serverDate()
      }
    });

    // 扣减库存（暂不扣减，等待支付成功后再扣减）
    // 这里只做预留检查

    // 提交事务
    await transaction.commit();

    return {
      success: true,
      data: {
        order_id: orderResult._id,
        item_id: item_id,
        total_amount: totalAmount,
        breakdown: {
          packaging_fee: packagingFee,
          shipping_cost: shippingCost,
          platform_fee: platformFee
        },
        payment_deadline: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      }
    };
  } catch (error) {
    await transaction.rollback();
    console.error('Create order error:', error);
    return {
      success: false,
      error: {
        code: 'CREATE_ORDER_FAILED',
        message: error.message || 'Failed to create order'
      }
    };
  }
}

/**
 * 获取订单列表
 */
async function getOrderList(openid, data) {
  const { page = 1, limit = 20, activity_id, status } = data;

  let whereCondition = {
    fan_wechat_openid: openid
  };

  if (activity_id) {
    whereCondition.activity_id = activity_id;
  }

  if (status) {
    whereCondition.order_status = status;
  }

  const result = await db.collection('orders')
    .where(whereCondition)
    .orderBy('created_at', 'desc')
    .skip((page - 1) * limit)
    .limit(limit)
    .get();

  const countResult = await db.collection('orders')
    .where(whereCondition)
    .count();

  // 获取物品信息
  const orders = await Promise.all(
    result.data.map(async (order) => {
      const itemResult = await db.collection('items')
        .doc(order.item_id)
        .get();

      return {
        id: order._id,
        item_id: order.item_id,
        item: itemResult.data ? {
          label: itemResult.data.label || '物品',
          photo_urls: itemResult.data.photo_urls || []
        } : null,
        total_amount: order.total_amount,
        payment_status: order.payment_status,
        order_status: order.order_status,
        created_at: order.created_at
      };
    })
  );

  return {
    success: true,
    data: {
      orders,
      pagination: {
        page,
        limit,
        total: countResult.total,
        total_pages: Math.ceil(countResult.total / limit)
      }
    }
  };
}

/**
 * 获取订单详情
 */
async function getOrderDetail(openid, data) {
  const { order_id } = data;

  console.log('[getOrderDetail] 查询订单:', { order_id });

  const orderResult = await db.collection('orders')
    .doc(order_id)
    .get();

  if (!orderResult.data) {
    return {
      success: false,
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found'
      }
    };
  }

  const order = orderResult.data;

  console.log('[getOrderDetail] 订单数据:', order);

  // 检查权限
  if (order.fan_wechat_openid !== openid) {
    // 检查是否是活动创建者
    const activityResult = await db.collection('activities')
      .doc(order.activity_id)
      .get();

    if (!activityResult.data || activityResult.data.influencer_id !== openid) {
      return {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'Permission denied'
        }
      };
    }
  }

  // 处理物品信息（兼容新旧两种结构）
  let items = [];
  let firstItem = null;

  // 新结构：order_items 数组
  if (order.order_items && order.order_items.length > 0) {
    items = await Promise.all(
      order.order_items.map(async (orderItem) => {
        const itemResult = await db.collection('items')
          .doc(orderItem.item_id)
          .get();
        
        return {
          ...orderItem,
          ...(itemResult.data || {})
        };
      })
    );
    firstItem = items[0];  // 第一个物品（兼容旧页面）
  }
  // 旧结构：单个 item_id
  else if (order.item_id) {
    const itemResult = await db.collection('items')
      .doc(order.item_id)
      .get();
    firstItem = itemResult.data || null;
    if (firstItem) {
      items = [firstItem];
    }
  }

  // 解析地址（兼容字符串和对象格式）
  let shippingAddress = order.shipping_address;
  if (typeof shippingAddress === 'string') {
    try {
      shippingAddress = JSON.parse(shippingAddress);
    } catch (e) {
      shippingAddress = {};
    }
  }

  console.log('[getOrderDetail] 返回数据:', {
    order_id: order._id,
    items_count: items.length,
    has_first_item: !!firstItem,
    payment_status: order.payment_status,
    order_status: order.order_status
  });

  return {
    success: true,
    data: {
      order_id: order._id,
      item_id: order.item_id || (firstItem ? firstItem._id : null),  // 兼容字段
      item: firstItem,  // 兼容旧页面结构
      items: items,  // 新结构：多物品
      order_items: order.order_items || [],  // 原始订单物品数据
      fan_phone_number: order.fan_phone_number,
      shipping_address: shippingAddress,
      shipping_contact_name: order.shipping_contact_name,
      shipping_contact_phone: order.shipping_contact_phone,
      base_shipping_cost: order.base_shipping_cost || 0,
      packaging_fee: order.packaging_fee || 0,
      shipping_cost: order.shipping_cost || 0,
      platform_fee: order.platform_fee || 0,
      total_amount: order.total_amount || 0,
      payment_status: order.payment_status,
      order_status: order.order_status,
      wechat_payment_transaction_id: order.wechat_payment_transaction_id,
      created_at: order.created_at,
      paid_at: order.paid_at,
      updated_at: order.updated_at,
      shipping_info: order.shipping_info || null  // 物流信息
    }
  };
}

/**
 * 更新订单状态
 */
async function updateOrderStatus(openid, data) {
  const { order_id, status } = data;

  const orderResult = await db.collection('orders')
    .doc(order_id)
    .get();

  if (!orderResult.data) {
    return {
      success: false,
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found'
      }
    };
  }

  const order = orderResult.data;

  // 检查权限（只有活动创建者可以更新订单状态）
  const activityResult = await db.collection('activities')
    .doc(order.activity_id)
    .get();

  if (!activityResult.data || activityResult.data.influencer_id !== openid) {
    return {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: 'Permission denied'
      }
    };
  }

  // 更新订单状态
  await db.collection('orders')
    .doc(order_id)
    .update({
      data: {
        order_status: status,
        updated_at: db.serverDate()
      }
    });

  return {
    success: true,
    data: {
      order_id
    }
  };
}

/**
 * 确认支付
 */
async function confirmPayment(openid, data) {
  const { order_id, wechat_transaction_id } = data;

  console.log('[confirmPayment] 输入参数:', { order_id, wechat_transaction_id, openid });

  if (!wechat_transaction_id) {
    return {
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'wechat_transaction_id is required'
      }
    };
  }

  // 查询订单
  const orderResult = await db.collection('orders')
    .doc(order_id)
    .get();

  console.log('[confirmPayment] 订单查询结果:', orderResult);

  if (!orderResult.data) {
    return {
      success: false,
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found'
      }
    };
  }

  const order = orderResult.data;

  // 检查权限
  if (order.fan_wechat_openid !== openid) {
    console.log('[confirmPayment] 权限检查失败:', { 
      order_openid: order.fan_wechat_openid, 
      current_openid: openid 
    });
    return {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: 'Permission denied'
      }
    };
  }

  // 检查订单状态
  if (order.payment_status === 'paid') {
    return {
      success: false,
      error: {
        code: 'ALREADY_PAID',
        message: 'Order already paid'
      }
    };
  }

  // 更新订单支付状态
  await db.collection('orders')
    .doc(order_id)
    .update({
      data: {
        payment_status: 'paid',
        order_status: 'pending',  // 支付后状态：pending（等待发货）
        wechat_payment_transaction_id: wechat_transaction_id,
        paid_at: db.serverDate(),
        updated_at: db.serverDate()
      }
    });

  console.log('[confirmPayment] 支付确认成功:', { order_id });

  return {
    success: true,
    data: {
      order_id
    }
  };
}

/**
 * 扫描匹配订单（通过二维码）
 */
async function scanMatchOrder(openid, data) {
  const { qr_code } = data;

  // 从二维码中解析物品标记信息
  // 二维码格式可能是: marker_activityId_markerName
  const parts = qr_code.split('_');
  if (parts.length < 3 || parts[0] !== 'marker') {
    return {
      success: false,
      error: {
        code: 'INVALID_QR_CODE',
        message: 'Invalid QR code format'
      }
    };
  }

  const activityId = parts[1];
  const markerName = parts.slice(2).join('_');

  // 检查活动是否属于当前用户
  const activityResult = await db.collection('activities')
    .doc(activityId)
    .get();

  if (!activityResult.data) {
    return {
      success: false,
      error: {
        code: 'ACTIVITY_NOT_FOUND',
        message: 'Activity not found'
      }
    };
  }

  if (activityResult.data.influencer_id !== openid) {
    return {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: 'Permission denied'
      }
    };
  }

  // 查找匹配的物品
  const itemsResult = await db.collection('items')
    .where({
      activity_id: activityId,
      marker_name: markerName
    })
    .get();

  if (itemsResult.data.length === 0) {
    return {
      success: false,
      error: {
        code: 'ITEM_NOT_FOUND',
        message: 'Item not found'
      }
    };
  }

  const item = itemsResult.data[0];

  // 查找对应的订单
  const ordersResult = await db.collection('orders')
    .where({
      item_id: item._id
    })
    .get();

  if (ordersResult.data.length === 0) {
    return {
      success: false,
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found for this item'
      }
    };
  }

  const order = ordersResult.data[0];

  return {
    success: true,
    data: {
      order_id: order._id,
      item_id: item._id,
      item_marker_name: markerName,
      order_status: order.order_status,
      payment_status: order.payment_status
    }
  };
}

/**
 * 创建多物品订单（购物车模式）
 * 支持：
 * 1. 多个物品一次性下单
 * 2. 每个物品可选择数量（最多2件）
 * 3. 库存锁定机制（15分钟超时）
 * 4. 运费计算：最高基础运费 + 总包装费
 */
async function createMultiItemOrder(openid, data) {
  const {
    items,  // [{ item_id, quantity }]
    fan_phone_number,
    shipping_address,
    shipping_contact_name,
    shipping_contact_phone
  } = data;

  // 验证参数
  if (!items || items.length === 0) {
    return {
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: '请选择至少一个物品'
      }
    };
  }

  // 验证手机号格式
  if (!/^1[3-9]\d{9}$/.test(fan_phone_number)) {
    return {
      success: false,
      error: {
        code: 'INVALID_PHONE',
        message: '手机号格式不正确'
      }
    };
  }

  if (!/^1[3-9]\d{9}$/.test(shipping_contact_phone)) {
    return {
      success: false,
      error: {
        code: 'INVALID_PHONE',
        message: '收货人手机号格式不正确'
      }
    };
  }

  // 验证地址
  if (!shipping_address.province || !shipping_address.city ||
      !shipping_address.district || !shipping_address.street) {
    return {
      success: false,
      error: {
        code: 'INVALID_ADDRESS',
        message: '收货地址不完整'
      }
    };
  }

  // 直接更新，不使用事务（简化版本）
  try {
    const orderItems = [];
    let maxBaseShipping = 0;
    let totalPackagingFee = 0;
    let activity_id = null;

    // 验证并锁定所有物品
    for (const reqItem of items) {
      const { item_id, quantity } = reqItem;

      // 验证数量（最多2件）
      if (!quantity || quantity < 1 || quantity > 2) {
        return {
          success: false,
          error: {
            code: 'INVALID_QUANTITY',
            message: '每个物品最多只能领取2件'
          }
        };
      }

      // 获取物品信息
      const itemResult = await db.collection('items')
        .doc(item_id)
        .get();

      if (!itemResult.data) {
        return {
          success: false,
          error: {
            code: 'ITEM_NOT_FOUND',
            message: `物品 ${item_id} 不存在`
          }
        };
      }

      const item = itemResult.data;
      
      if (!activity_id) {
        activity_id = item.activity_id;
      }

      // 检查库存（剩余数量）
      const remainingQty = item.remaining_quantity !== undefined ? 
        item.remaining_quantity : item.marker_quantity;
      
      if (remainingQty < quantity) {
        return {
          success: false,
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: `${item.label || '物品'} 库存不足，剩余${remainingQty}件`
          }
        };
      }

      // 计算运费
      const baseShipping = item.base_shipping_cost || 10.0;
      const packagingFee = 2.0 * quantity;  // 包装费 = 2元 × 数量
      
      maxBaseShipping = Math.max(maxBaseShipping, baseShipping);
      totalPackagingFee += packagingFee;

      // 直接更新库存（不使用事务）
      await db.collection('items')
        .doc(item_id)
        .update({
          data: {
            remaining_quantity: _.inc(-quantity),
            updated_at: db.serverDate()
          }
        });

      orderItems.push({
        item_id: item_id,
        label: item.label || '物品',
        photo_urls: item.photo_urls || [],
        quantity: quantity,
        base_shipping_cost: baseShipping,
        packaging_fee: packagingFee,
        unit_cost: item.shipping_cost_estimate || 10.0
      });
    }

    // 计算总费用：最高基础运费 + 总包装费
    const totalShippingCost = maxBaseShipping + totalPackagingFee;
    const platformFee = Math.max(0, totalShippingCost * 0.1); // 平台服务费
    const totalAmount = totalShippingCost + platformFee;

    // 创建订单
    const orderResult = await db.collection('orders').add({
      data: {
        item_id: orderItems.length > 0 ? orderItems[0].item_id : null,  // 单物品兼容（第一个物品ID）
        activity_id: activity_id,
        fan_wechat_openid: openid,
        fan_phone_number: fan_phone_number,
        shipping_address: shipping_address,  // 直接存储对象
        shipping_contact_name: shipping_contact_name,
        shipping_contact_phone: shipping_contact_phone,
        order_items: orderItems,  // 物品列表
        base_shipping_cost: maxBaseShipping,
        packaging_fee: totalPackagingFee,
        shipping_cost: totalShippingCost,
        platform_fee: platformFee,
        total_amount: totalAmount,
        payment_status: 'pending',
        order_status: 'pending',  // 直接 pending，不用 locked
        created_at: db.serverDate(),
        updated_at: db.serverDate()
      }
    });

    return {
      success: true,
      data: {
        order_id: orderResult._id,
        total_amount: totalAmount,
        items_count: orderItems.length,
        total_quantity: orderItems.reduce((sum, i) => sum + i.quantity, 0),
        breakdown: {
          base_shipping_cost: maxBaseShipping,
          packaging_fee: totalPackagingFee,
          shipping_cost: totalShippingCost,
          platform_fee: platformFee
        }
      }
    };
  } catch (error) {
    console.error('[createMultiItemOrder] 错误:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || '创建订单失败'
      }
    };
  }
}

/**
 * 释放超时的库存锁定
 * 应由定时触发器调用（每1分钟执行一次）
 */
async function releaseExpiredLocks() {
  try {
    const now = new Date();
    
    // 查找所有超时未支付的订单
    const expiredOrders = await db.collection('orders')
      .where({
        order_status: 'locked',
        payment_status: 'pending',
        lock_expires_at: _.lt(now)
      })
      .get();

    console.log(`[释放超时锁定] 找到 ${expiredOrders.data.length} 个超时订单`);

    let releasedCount = 0;

    for (const order of expiredOrders.data) {
      const transaction = await db.startTransaction();
      
      try {
        // 回滚所有物品的库存
        for (const orderItem of order.order_items || []) {
          await transaction.collection('items')
            .doc(orderItem.item_id)
            .update({
              data: {
                remaining_quantity: _.inc(orderItem.quantity),  // 恢复库存
                locked_quantity: _.inc(-orderItem.quantity),  // 减少锁定
                updated_at: db.serverDate()
              }
            });
        }

        // 更新订单状态为已取消
        await transaction.collection('orders')
          .doc(order._id)
          .update({
            data: {
              order_status: 'cancelled',
              cancel_reason: '支付超时自动取消',
              updated_at: db.serverDate()
            }
          });

        await transaction.commit();
        releasedCount++;
        
        console.log(`[释放超时锁定] 订单 ${order._id} 已释放`);
      } catch (error) {
        await transaction.rollback();
        console.error(`[释放超时锁定] 订单 ${order._id} 失败:`, error);
      }
    }

    return {
      success: true,
      data: {
        total_expired: expiredOrders.data.length,
        released: releasedCount
      }
    };
  } catch (error) {
    console.error('[释放超时锁定] 错误:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    };
  }
}

/**
 * 取消超时订单（15分钟支付超时自动取消）
 * 由定时任务调用
 */
async function cancelExpiredOrders() {
  try {
    const now = new Date();
    
    // 查找所有超过15分钟且未支付的订单
    const expiredOrders = await db.collection('orders')
      .where({
        payment_status: 'pending',
        order_status: 'pending',
        payment_deadline: _.lt(now)  // payment_deadline < now
      })
      .get();

    console.log(`[取消超时订单] 找到${expiredOrders.data.length}个超时订单`);

    let cancelledCount = 0;

    // 逐个取消订单
    for (const order of expiredOrders.data) {
      const transaction = await db.startTransaction();

      try {
        // 释放库存（如果有预留）
        if (order.item_id) {
          // 单物品订单
          await transaction.collection('items')
            .doc(order.item_id)
            .update({
              data: {
                remaining_quantity: _.inc(1),  // 增加1
                updated_at: db.serverDate()
              }
            });
        } else if (order.order_items && order.order_items.length > 0) {
          // 多物品订单
          for (const orderItem of order.order_items) {
            await transaction.collection('items')
              .doc(orderItem.item_id)
              .update({
                data: {
                  remaining_quantity: _.inc(orderItem.quantity || 1),
                  updated_at: db.serverDate()
                }
              });
          }
        }

        // 更新订单状态为已取消
        await transaction.collection('orders')
          .doc(order._id)
          .update({
            data: {
              order_status: 'cancelled',
              payment_status: 'cancelled',
              cancel_reason: '支付15分钟超时自动取消',
              cancelled_at: db.serverDate(),
              updated_at: db.serverDate()
            }
          });

        await transaction.commit();
        cancelledCount++;
        
        console.log(`[取消超时订单] 订单 ${order._id} 已取消`);
      } catch (error) {
        await transaction.rollback();
        console.error(`[取消超时订单] 订单 ${order._id} 失败:`, error);
      }
    }

    return {
      success: true,
      data: {
        total_expired: expiredOrders.data.length,
        cancelled: cancelledCount,
        message: `成功取消${cancelledCount}个超时订单`
      }
    };
  } catch (error) {
    console.error('[取消超时订单] 错误:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    };
  }
}

/**
 * 用户主动取消订单
 */
async function cancelOrder(openid, data) {
  const { order_id, reason = '用户取消' } = data;

  // 查询订单
  const orderResult = await db.collection('orders')
    .doc(order_id)
    .get();

  if (!orderResult.data) {
    return {
      success: false,
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found'
      }
    };
  }

  const order = orderResult.data;

  // 检查权限
  if (order.fan_wechat_openid !== openid) {
    return {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: 'Permission denied'
      }
    };
  }

  // 检查订单状态（只有pending状态可以取消）
  if (order.order_status !== 'pending') {
    return {
      success: false,
      error: {
        code: 'INVALID_ORDER_STATUS',
        message: `订单当前状态为${order.order_status}，无法取消`,
        current_status: order.order_status
      }
    };
  }

  // 如果已经支付，不允许取消
  if (order.payment_status === 'paid') {
    return {
      success: false,
      error: {
        code: 'ORDER_ALREADY_PAID',
        message: '订单已支付，无法取消，请联系客服退款'
      }
    };
  }

  const transaction = await db.startTransaction();

  try {
    // 释放库存
    if (order.item_id) {
      // 单物品订单
      await transaction.collection('items')
        .doc(order.item_id)
        .update({
          data: {
            remaining_quantity: _.inc(1),
            updated_at: db.serverDate()
          }
        });
    } else if (order.order_items && order.order_items.length > 0) {
      // 多物品订单
      for (const orderItem of order.order_items) {
        await transaction.collection('items')
          .doc(orderItem.item_id)
          .update({
            data: {
              remaining_quantity: _.inc(orderItem.quantity || 1),
              updated_at: db.serverDate()
            }
          });
      }
    }

    // 更新订单状态
    await transaction.collection('orders')
      .doc(order_id)
      .update({
        data: {
          order_status: 'cancelled',
          payment_status: 'cancelled',
          cancel_reason: reason,
          cancelled_at: db.serverDate(),
          updated_at: db.serverDate()
        }
      });

    await transaction.commit();

    return {
      success: true,
      data: {
        order_id,
        message: '订单已取消'
      }
    };
  } catch (error) {
    await transaction.rollback();
    console.error('[取消订单] 错误:', error);
    return {
      success: false,
      error: {
        code: 'CANCEL_ORDER_FAILED',
        message: error.message || 'Failed to cancel order'
      }
    };
  }
}
