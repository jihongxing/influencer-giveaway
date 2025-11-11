// 发货管理云函数
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
      case 'processShipping':  // 处理发货（支付成功后自动调用）
        return await processShipping(OPENID, data);
      case 'manualShip':  // 手动发货
        return await manualShip(OPENID, data);
      case 'getShippingInfo':  // 获取发货信息
        return await getShippingInfo(OPENID, data);
      case 'updateTracking':  // 更新物流信息
        return await updateTrackingInfo(data);
      case 'checkPendingShipments':  // 检查待发货订单（48小时提醒）
        return await checkPendingShipments();
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
    console.error('Shipping function error:', error);
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
 * 处理发货（支付成功后自动调用快递API下单）
 * 由支付回调触发
 */
async function processShipping(openid, data) {
  const { order_id } = data;

  console.log('[处理发货] 开始处理:', { order_id, openid });

  // 查询订单
  const orderResult = await db.collection('orders')
    .doc(order_id)
    .get();

  if (!orderResult.data) {
    return {
      success: false,
      error: {
        code: 'ORDER_NOT_FOUND',
        message: '订单不存在'
      }
    };
  }

  const order = orderResult.data;

  // 检查订单状态
  if (order.payment_status !== 'paid') {
    return {
      success: false,
      error: {
        code: 'ORDER_NOT_PAID',
        message: '订单未支付'
      }
    };
  }

  if (order.order_status === 'shipped') {
    return {
      success: false,
      error: {
        code: 'ALREADY_SHIPPED',
        message: '订单已发货'
      }
    };
  }

  // 获取活动信息（获取发货地址快照）
  const activityResult = await db.collection('activities')
    .doc(order.activity_id)
    .get();

  if (!activityResult.data) {
    return {
      success: false,
      error: {
        code: 'ACTIVITY_NOT_FOUND',
        message: '活动不存在'
      }
    };
  }

  const activity = activityResult.data;

  // 检查权限（仅限活动创建者）
  if (activity.influencer_id !== openid) {
    return {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: '无权限操作此订单'
      }
    };
  }

  try {
    // 解析收货地址
    let shippingAddress = order.shipping_address;
    if (typeof shippingAddress === 'string') {
      shippingAddress = JSON.parse(shippingAddress);
    }

    // 调用快递API下单
    const expressResult = await cloud.callFunction({
      name: 'express-api',
      data: {
        action: 'createOrder',
        data: {
          order_id: order_id,
          sender_info: {
            name: activity.sender_name || activity.influencer_name,
            phone: activity.sender_phone,
            province: activity.sender_address?.province,
            city: activity.sender_address?.city,
            district: activity.sender_address?.district,
            detail: activity.sender_address?.detail
          },
          receiver_info: {
            name: order.shipping_contact_name,
            phone: order.shipping_contact_phone,
            province: shippingAddress.province,
            city: shippingAddress.city,
            district: shippingAddress.district,
            detail: shippingAddress.street
          },
          courier: activity.preferred_courier || 'yuantong'
        }
      }
    });

    console.log('[处理发货] 快递下单结果:', expressResult.result);

    if (!expressResult.result.success) {
      return {
        success: false,
        error: {
          code: 'EXPRESS_ORDER_FAILED',
          message: expressResult.result.error?.message || '快递下单失败'
        }
      };
    }

    const expressData = expressResult.result.data;

    // 创建物流信息记录
    const shippingInfo = await db.collection('shipping_info').add({
      data: {
        order_id: order_id,
        express_company: expressData.courier || activity.preferred_courier || 'yuantong',
        express_number: expressData.express_number,
        sender_info: {
          name: activity.sender_name || activity.influencer_name,
          phone: activity.sender_phone,
          address: activity.sender_address
        },
        receiver_info: {
          name: order.shipping_contact_name,
          phone: order.shipping_contact_phone,
          address: shippingAddress
        },
        tracking_status: 'pending',  // pending/in_transit/delivered
        tracking_info: null,
        last_check_at: null,
        shipped_at: db.serverDate(),
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
          shipping_info_id: shippingInfo._id,
          shipped_at: db.serverDate(),
          updated_at: db.serverDate()
        }
      });

    console.log('[处理发货] 发货完成:', { order_id, express_number: expressData.express_number });

    return {
      success: true,
      data: {
        order_id,
        shipping_info_id: shippingInfo._id,
        express_company: expressData.courier,
        express_number: expressData.express_number,
        message: '发货成功'
      }
    };
  } catch (error) {
    console.error('[处理发货] 错误:', error);
    return {
      success: false,
      error: {
        code: 'SHIPPING_PROCESS_FAILED',
        message: error.message || '发货处理失败'
      }
    };
  }
}

/**
 * 手动发货（主播手动操作）
 */
async function manualShip(openid, data) {
  const { order_id, express_company, express_number } = data;

  console.log('[手动发货] 开始:', { order_id, express_company, express_number });

  // 查询订单
  const orderResult = await db.collection('orders')
    .doc(order_id)
    .get();

  if (!orderResult.data) {
    return {
      success: false,
      error: {
        code: 'ORDER_NOT_FOUND',
        message: '订单不存在'
      }
    };
  }

  const order = orderResult.data;

  // 获取活动信息
  const activityResult = await db.collection('activities')
    .doc(order.activity_id)
    .get();

  if (!activityResult.data) {
    return {
      success: false,
      error: {
        code: 'ACTIVITY_NOT_FOUND',
        message: '活动不存在'
      }
    };
  }

  const activity = activityResult.data;

  // 检查权限
  if (activity.influencer_id !== openid) {
    return {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: '无权限操作此订单'
      }
    };
  }

  // 检查订单状态
  if (order.payment_status !== 'paid') {
    return {
      success: false,
      error: {
        code: 'ORDER_NOT_PAID',
        message: '订单未支付，无法发货'
      }
    };
  }

  if (order.order_status === 'shipped') {
    return {
      success: false,
      error: {
        code: 'ALREADY_SHIPPED',
        message: '订单已发货'
      }
    };
  }

  try {
    // 解析收货地址
    let shippingAddress = order.shipping_address;
    if (typeof shippingAddress === 'string') {
      shippingAddress = JSON.parse(shippingAddress);
    }

    // 创建物流信息记录
    const shippingInfo = await db.collection('shipping_info').add({
      data: {
        order_id: order_id,
        express_company: express_company,
        express_number: express_number,
        sender_info: {
          name: activity.sender_name || activity.influencer_name,
          phone: activity.sender_phone,
          address: activity.sender_address
        },
        receiver_info: {
          name: order.shipping_contact_name,
          phone: order.shipping_contact_phone,
          address: shippingAddress
        },
        tracking_status: 'pending',
        tracking_info: null,
        last_check_at: null,
        shipped_at: db.serverDate(),
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
          shipping_info_id: shippingInfo._id,
          shipped_at: db.serverDate(),
          updated_at: db.serverDate()
        }
      });

    console.log('[手动发货] 完成:', { order_id, express_number });

    return {
      success: true,
      data: {
        order_id,
        shipping_info_id: shippingInfo._id,
        express_company,
        express_number,
        message: '发货成功'
      }
    };
  } catch (error) {
    console.error('[手动发货] 错误:', error);
    return {
      success: false,
      error: {
        code: 'MANUAL_SHIP_FAILED',
        message: error.message || '手动发货失败'
      }
    };
  }
}

/**
 * 获取发货信息
 */
async function getShippingInfo(openid, data) {
  const { order_id } = data;

  // 查询订单
  const orderResult = await db.collection('orders')
    .doc(order_id)
    .get();

  if (!orderResult.data) {
    return {
      success: false,
      error: {
        code: 'ORDER_NOT_FOUND',
        message: '订单不存在'
      }
    };
  }

  const order = orderResult.data;

  // 检查权限（粉丝本人或活动创建者）
  let hasPermission = false;
  if (order.fan_wechat_openid === openid) {
    hasPermission = true;
  } else {
    const activityResult = await db.collection('activities')
      .doc(order.activity_id)
      .get();
    if (activityResult.data && activityResult.data.influencer_id === openid) {
      hasPermission = true;
    }
  }

  if (!hasPermission) {
    return {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: '无权限查看此订单物流信息'
      }
    };
  }

  // 查询物流信息
  if (!order.shipping_info_id) {
    return {
      success: true,
      data: {
        order_id,
        order_status: order.order_status,
        shipped: false,
        message: '订单未发货'
      }
    };
  }

  const shippingResult = await db.collection('shipping_info')
    .doc(order.shipping_info_id)
    .get();

  if (!shippingResult.data) {
    return {
      success: false,
      error: {
        code: 'SHIPPING_INFO_NOT_FOUND',
        message: '物流信息不存在'
      }
    };
  }

  return {
    success: true,
    data: {
      order_id,
      shipped: true,
      ...shippingResult.data
    }
  };
}

/**
 * 更新物流跟踪信息（由定时器调用）
 */
async function updateTrackingInfo(data) {
  const { shipping_info_id } = data;

  console.log('[更新物流] 开始:', shipping_info_id);

  // 查询物流信息
  const shippingResult = await db.collection('shipping_info')
    .doc(shipping_info_id)
    .get();

  if (!shippingResult.data) {
    return {
      success: false,
      error: {
        code: 'SHIPPING_INFO_NOT_FOUND',
        message: '物流信息不存在'
      }
    };
  }

  const shipping = shippingResult.data;

  // 如果已签收，不再查询
  if (shipping.tracking_status === 'delivered') {
    return {
      success: true,
      data: {
        shipping_info_id,
        status: 'delivered',
        message: '已签收，无需继续跟踪'
      }
    };
  }

  try {
    // 调用快递API查询物流
    const trackResult = await cloud.callFunction({
      name: 'express-api',
      data: {
        action: 'trackShipment',
        data: {
          express_company: shipping.express_company,
          express_number: shipping.express_number
        }
      }
    });

    console.log('[更新物流] 查询结果:', trackResult.result);

    if (!trackResult.result.success) {
      return {
        success: false,
        error: {
          code: 'TRACK_FAILED',
          message: trackResult.result.error?.message || '物流查询失败'
        }
      };
    }

    const trackData = trackResult.result.data;

    // 判断物流状态
    let trackingStatus = 'pending';
    if (trackData.state === '3') {
      trackingStatus = 'delivered';  // 已签收
    } else if (trackData.data && trackData.data.length > 0) {
      trackingStatus = 'in_transit';  // 运输中
    }

    // 更新物流信息
    await db.collection('shipping_info')
      .doc(shipping_info_id)
      .update({
        data: {
          tracking_status: trackingStatus,
          tracking_info: trackData,
          last_check_at: db.serverDate(),
          updated_at: db.serverDate()
        }
      });

    // 如果已签收，更新订单状态
    if (trackingStatus === 'delivered') {
      await db.collection('orders')
        .doc(shipping.order_id)
        .update({
          data: {
            order_status: 'delivered',
            delivered_at: db.serverDate(),
            updated_at: db.serverDate()
          }
        });
    }

    console.log('[更新物流] 完成:', { shipping_info_id, status: trackingStatus });

    return {
      success: true,
      data: {
        shipping_info_id,
        tracking_status: trackingStatus,
        tracking_info: trackData
      }
    };
  } catch (error) {
    console.error('[更新物流] 错误:', error);
    return {
      success: false,
      error: {
        code: 'UPDATE_TRACKING_FAILED',
        message: error.message || '更新物流信息失败'
      }
    };
  }
}

/**
 * 检查待发货订单（48小时提醒）
 * 由定时器每6小时执行一次
 */
async function checkPendingShipments() {
  console.log('[检查待发货订单] 开始执行...');

  try {
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // 查询已支付但未发货且超过48小时的订单
    const pendingOrders = await db.collection('orders')
      .where({
        payment_status: 'paid',
        order_status: 'pending',
        paid_at: _.lt(fortyEightHoursAgo)
      })
      .get();

    console.log(`[检查待发货订单] 找到${pendingOrders.data.length}个超时订单`);

    const reminders = [];

    for (const order of pendingOrders.data) {
      // 获取活动信息
      const activityResult = await db.collection('activities')
        .doc(order.activity_id)
        .get();

      if (activityResult.data) {
        const activity = activityResult.data;
        
        // 计算超时小时数
        const paidTime = new Date(order.paid_at);
        const hoursPassed = Math.floor((now - paidTime) / (60 * 60 * 1000));

        reminders.push({
          order_id: order._id,
          activity_id: order.activity_id,
          influencer_id: activity.influencer_id,
          hours_overdue: hoursPassed - 48,
          paid_at: order.paid_at
        });

        // 这里可以发送模板消息提醒主播
        // await sendShippingReminder(activity.influencer_id, order._id, hoursPassed);

        console.log(`[检查待发货订单] 订单 ${order._id} 已超时${hoursPassed - 48}小时`);
      }
    }

    return {
      success: true,
      data: {
        total_pending: pendingOrders.data.length,
        reminders: reminders,
        message: `检查完成，发现${reminders.length}个超时订单`
      }
    };
  } catch (error) {
    console.error('[检查待发货订单] 错误:', error);
    return {
      success: false,
      error: {
        code: 'CHECK_PENDING_FAILED',
        message: error.message
      }
    };
  }
}
