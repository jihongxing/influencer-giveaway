// 支付处理云函数
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
      case 'unifiedOrder':  // 统一下单
        return await unifiedOrder(OPENID, data);
      case 'queryPayment':  // 查询支付状态
        return await queryPayment(OPENID, data);
      case 'refund':  // 申请退款
        return await refundPayment(OPENID, data);
      case 'handleWebhook':  // 支付回调
        return await handlePaymentWebhook(data);
      case 'submitOfflinePayment':  // 提交线下支付（个人认证小程序使用）
        return await submitOfflinePayment(OPENID, data);
      case 'reviewOfflinePayment':  // 审核线下支付（主播操作）
        return await reviewOfflinePayment(OPENID, data);
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
    console.error('Payments function error:', error);
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
 * 统一下单（调用微信支付）
 */
async function unifiedOrder(openid, data) {
  const { order_id } = data;

  console.log('[统一下单] 开始处理:', { order_id, openid });

  // 获取订单信息
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

  // 检查权限
  if (order.fan_wechat_openid !== openid) {
    return {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: '无权限访问此订单'
      }
    };
  }

  // 检查订单状态
  if (order.payment_status === 'paid') {
    return {
      success: false,
      error: {
        code: 'ALREADY_PAID',
        message: '订单已支付'
      }
    };
  }

  // 检查订单是否超时
  if (order.payment_deadline && new Date(order.payment_deadline) < new Date()) {
    return {
      success: false,
      error: {
        code: 'ORDER_EXPIRED',
        message: '订单已超时，请重新下单'
      }
    };
  }

  // 检查订单是否已取消
  if (order.order_status === 'cancelled') {
    return {
      success: false,
      error: {
        code: 'ORDER_CANCELLED',
        message: '订单已取消'
      }
    };
  }

  try {
    // 调用微信支付统一下单API
    const result = await cloud.cloudPay.unifiedOrder({
      body: `赠品领取-订单${order_id.substr(-8)}`,
      outTradeNo: order_id,
      spbillCreateIp: '127.0.0.1',
      subMchId: process.env.WECHAT_SUB_MCHID || '',
      totalFee: Math.round(order.total_amount * 100),  // 转换为分
      envId: cloud.DYNAMIC_CURRENT_ENV,
      functionName: 'payments',  // 支付回调云函数
      nonceStr: generateNonceStr(),
      tradeType: 'JSAPI',
      openid: openid
    });

    console.log('[统一下单] 微信支付响应:', result);

    // 创建支付记录
    const paymentRecord = await db.collection('payments').add({
      data: {
        order_id: order_id,
        transaction_id: null,  // 支付成功后更新
        out_trade_no: order_id,
        payment_method: 'wechat_pay',
        amount: order.total_amount,
        currency: 'CNY',
        status: 'pending',
        prepay_id: result.prepayId || null,
        created_at: db.serverDate(),
        updated_at: db.serverDate()
      }
    });

    console.log('[统一下单] 支付记录已创建:', paymentRecord._id);

    return {
      success: true,
      data: {
        payment_id: paymentRecord._id,
        ...result  // 包含timeStamp, nonceStr, package, signType, paySign
      }
    };
  } catch (error) {
    console.error('[统一下单] 错误:', error);
    return {
      success: false,
      error: {
        code: 'PAYMENT_FAILED',
        message: error.message || '发起支付失败，请稍后重试'
      }
    };
  }
}

/**
 * 查询支付状态
 */
async function queryPayment(openid, data) {
  const { order_id } = data;

  console.log('[查询支付] 开始:', { order_id, openid });

  // 获取订单信息
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

  // 检查权限
  if (order.fan_wechat_openid !== openid) {
    return {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: '无权限访问此订单'
      }
    };
  }

  // 查询支付记录
  const paymentResult = await db.collection('payments')
    .where({
      order_id: order_id
    })
    .orderBy('created_at', 'desc')
    .limit(1)
    .get();

  if (paymentResult.data.length === 0) {
    return {
      success: true,
      data: {
        payment_status: order.payment_status,
        order_status: order.order_status,
        paid: false
      }
    };
  }

  const payment = paymentResult.data[0];

  return {
    success: true,
    data: {
      payment_id: payment._id,
      payment_status: order.payment_status,
      order_status: order.order_status,
      transaction_id: payment.transaction_id,
      amount: payment.amount,
      paid: order.payment_status === 'paid',
      paid_at: order.paid_at
    }
  };
}

/**
 * 处理支付回调
 */
async function handlePaymentWebhook(data) {
  console.log('[支付回调] 收到回调数据:', data);

  const { returnCode, resultCode, outTradeNo, transactionId, totalFee } = data;

  // 检查支付是否成功
  if (returnCode !== 'SUCCESS' || resultCode !== 'SUCCESS') {
    console.error('[支付回调] 支付失败:', data);
    return {
      success: false,
      error: {
        code: 'PAYMENT_FAILED',
        message: '支付失败'
      }
    };
  }

  const order_id = outTradeNo;
  const transaction = await db.startTransaction();

  try {
    // 查询订单
    const orderResult = await transaction.collection('orders')
      .doc(order_id)
      .get();

    if (!orderResult.data) {
      await transaction.rollback();
      console.error('[支付回调] 订单不存在:', order_id);
      return {
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: '订单不存在'
        }
      };
    }

    const order = orderResult.data;

    // 检查订单是否已支付（防止重复回调）
    if (order.payment_status === 'paid') {
      await transaction.rollback();
      console.log('[支付回调] 订单已支付，忽略重复回调:', order_id);
      return {
        success: true,
        data: {
          message: '订单已支付'
        }
      };
    }

    // 更新支付记录
    const paymentResult = await transaction.collection('payments')
      .where({
        order_id: order_id
      })
      .get();

    if (paymentResult.data.length > 0) {
      await transaction.collection('payments')
        .doc(paymentResult.data[0]._id)
        .update({
          data: {
            transaction_id: transactionId,
            status: 'paid',
            paid_at: db.serverDate(),
            updated_at: db.serverDate()
          }
        });
    }

    // 更新订单状态
    await transaction.collection('orders')
      .doc(order_id)
      .update({
        data: {
          payment_status: 'paid',
          order_status: 'pending',  // 待发货
          wechat_payment_transaction_id: transactionId,
          paid_at: db.serverDate(),
          updated_at: db.serverDate()
        }
      });

    // 扣减库存
    if (order.item_id) {
      // 单物品订单
      await transaction.collection('items')
        .doc(order.item_id)
        .update({
          data: {
            remaining_quantity: _.inc(-1),
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
              remaining_quantity: _.inc(-(orderItem.quantity || 1)),
              updated_at: db.serverDate()
            }
          });
      }
    }

    await transaction.commit();
    
    console.log('[支付回调] 处理成功:', { order_id, transaction_id: transactionId });

    // 异步触发发货流程（不阻塞支付回调响应）
    // 注意：这里不等待结果，让发货在后台异步执行
    cloud.callFunction({
      name: 'shipping',
      data: {
        action: 'processShipping',
        data: { order_id }
      }
    }).then(result => {
      console.log('[支付回调] 自动发货结果:', result);
    }).catch(error => {
      console.error('[支付回调] 自动发货失败:', error);
      // 发货失败不影响支付流程，主播可以后续手动发货
    });

    return {
      success: true,
      data: {
        message: '支付回调处理成功',
        order_id,
        transaction_id: transactionId
      }
    };
  } catch (error) {
    await transaction.rollback();
    console.error('[支付回调] 处理失败:', error);
    return {
      success: false,
      error: {
        code: 'WEBHOOK_PROCESS_FAILED',
        message: error.message || '支付回调处理失败'
      }
    };
  }
}

/**
 * 申请退款（支付后未发货可退款）
 */
async function refundPayment(openid, data) {
  const { order_id, reason = '用户申请退款' } = data;

  console.log('[申请退款] 开始:', { order_id, openid, reason });

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

  // 检查权限（粉丝本人或主播）
  let hasPermission = false;
  if (order.fan_wechat_openid === openid) {
    hasPermission = true;
  } else {
    // 检查是否是主播
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
        message: '无权限操作此订单'
      }
    };
  }

  // 检查订单状态（只有已支付且未发货的订单可以退款）
  if (order.payment_status !== 'paid') {
    return {
      success: false,
      error: {
        code: 'ORDER_NOT_PAID',
        message: '订单未支付，无需退款'
      }
    };
  }

  if (order.order_status === 'shipped' || order.order_status === 'delivered') {
    return {
      success: false,
      error: {
        code: 'ORDER_ALREADY_SHIPPED',
        message: '订单已发货，无法退款',
        current_status: order.order_status
      }
    };
  }

  if (order.order_status === 'refunded') {
    return {
      success: false,
      error: {
        code: 'ALREADY_REFUNDED',
        message: '订单已退款'
      }
    };
  }

  // 查询支付记录
  const paymentResult = await db.collection('payments')
    .where({
      order_id: order_id,
      status: 'paid'
    })
    .orderBy('created_at', 'desc')
    .limit(1)
    .get();

  if (paymentResult.data.length === 0) {
    return {
      success: false,
      error: {
        code: 'PAYMENT_NOT_FOUND',
        message: '未找到支付记录'
      }
    };
  }

  const payment = paymentResult.data[0];

  try {
    // 调用微信支付退款API
    const refundResult = await cloud.cloudPay.refund({
      outTradeNo: order_id,
      outRefundNo: `refund_${order_id}_${Date.now()}`,
      totalFee: Math.round(order.total_amount * 100),  // 总金额（分）
      refundFee: Math.round(order.total_amount * 100),  // 退款金额（分）
      envId: cloud.DYNAMIC_CURRENT_ENV,
      functionName: 'payments'
    });

    console.log('[申请退款] 微信退款响应:', refundResult);

    const transaction = await db.startTransaction();

    try {
      // 更新支付记录
      await transaction.collection('payments')
        .doc(payment._id)
        .update({
          data: {
            status: 'refunded',
            refund_transaction_id: refundResult.refundId || null,
            refunded_at: db.serverDate(),
            updated_at: db.serverDate()
          }
        });

      // 更新订单状态
      await transaction.collection('orders')
        .doc(order_id)
        .update({
          data: {
            payment_status: 'refunded',
            order_status: 'refunded',
            refund_reason: reason,
            refunded_at: db.serverDate(),
            updated_at: db.serverDate()
          }
        });

      // 释放库存
      if (order.item_id) {
        await transaction.collection('items')
          .doc(order.item_id)
          .update({
            data: {
              remaining_quantity: _.inc(1),
              updated_at: db.serverDate()
            }
          });
      } else if (order.order_items && order.order_items.length > 0) {
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

      await transaction.commit();

      console.log('[申请退款] 退款成功:', order_id);

      return {
        success: true,
        data: {
          order_id,
          refund_id: refundResult.refundId,
          message: '退款成功'
        }
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('[申请退款] 错误:', error);
    return {
      success: false,
      error: {
        code: 'REFUND_FAILED',
        message: error.message || '退款失败，请稍后重试'
      }
    };
  }
}

/**
 * 生成随机字符串
 */
function generateNonceStr(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 提交线下支付（个人认证小程序使用）
 * 用户上传支付凭证，等待主播审核
 */
async function submitOfflinePayment(openid, data) {
  const { order_id, payment_proof, payment_method = 'offline' } = data;

  console.log('[提交线下支付] 开始处理:', { order_id, openid });

  // 获取订单信息
  const orderResult = await db.collection('orders').doc(order_id).get();

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

  // 检查权限
  if (order.fan_wechat_openid !== openid) {
    return {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: '无权限访问此订单'
      }
    };
  }

  // 检查订单状态
  if (order.payment_status === 'paid') {
    return {
      success: false,
      error: {
        code: 'ALREADY_PAID',
        message: '订单已支付'
      }
    };
  }

  try {
    // 创建支付记录
    const paymentRecord = await db.collection('payments').add({
      data: {
        order_id: order_id,
        transaction_id: null,
        out_trade_no: `OFFLINE_${order_id}_${Date.now()}`,
        payment_method: payment_method,
        amount: order.total_amount,
        currency: 'CNY',
        status: 'reviewing', // 审核中
        payment_proof: payment_proof, // 支付凭证
        created_at: db.serverDate(),
        updated_at: db.serverDate()
      }
    });

    // 更新订单状态
    await db.collection('orders').doc(order_id).update({
      data: {
        payment_status: 'reviewing', // 审核中
        payment_method: payment_method,
        updated_at: db.serverDate()
      }
    });

    console.log('[提交线下支付] 成功:', paymentRecord._id);

    return {
      success: true,
      data: {
        payment_id: paymentRecord._id,
        message: '支付凭证已提交，请等待审核'
      }
    };
  } catch (error) {
    console.error('[提交线下支付] 错误:', error);
    return {
      success: false,
      error: {
        code: 'SUBMIT_FAILED',
        message: error.message || '提交失败，请稍后重试'
      }
    };
  }
}

/**
 * 审核线下支付（主播操作）
 * approve: true - 通过， false - 拒绝
 */
async function reviewOfflinePayment(openid, data) {
  const { payment_id, approve, reject_reason } = data;

  console.log('[审核线下支付] 开始处理:', { payment_id, approve, openid });

  // 获取支付记录
  const paymentResult = await db.collection('payments').doc(payment_id).get();

  if (!paymentResult.data) {
    return {
      success: false,
      error: {
        code: 'PAYMENT_NOT_FOUND',
        message: '支付记录不存在'
      }
    };
  }

  const payment = paymentResult.data;

  // 获取订单信息
  const orderResult = await db.collection('orders').doc(payment.order_id).get();
  
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

  // 检查权限（只有主播可以审核）
  if (order.influencer_wechat_openid !== openid) {
    return {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: '无权限进行此操作'
      }
    };
  }

  try {
    if (approve) {
      // 通过审核
      await db.collection('payments').doc(payment_id).update({
        data: {
          status: 'paid',
          reviewed_at: db.serverDate(),
          updated_at: db.serverDate()
        }
      });

      await db.collection('orders').doc(payment.order_id).update({
        data: {
          payment_status: 'paid',
          order_status: 'paid',
          paid_at: db.serverDate(),
          updated_at: db.serverDate()
        }
      });

      console.log('[审核线下支付] 审核通过:', payment_id);

      return {
        success: true,
        data: {
          message: '审核通过'
        }
      };
    } else {
      // 拒绝审核
      await db.collection('payments').doc(payment_id).update({
        data: {
          status: 'rejected',
          reject_reason: reject_reason || '支付凭证不符合要求',
          reviewed_at: db.serverDate(),
          updated_at: db.serverDate()
        }
      });

      await db.collection('orders').doc(payment.order_id).update({
        data: {
          payment_status: 'pending',
          updated_at: db.serverDate()
        }
      });

      console.log('[审核线下支付] 审核拒绝:', payment_id);

      return {
        success: true,
        data: {
          message: '审核拒绝'
        }
      };
    }
  } catch (error) {
    console.error('[审核线下支付] 错误:', error);
    return {
      success: false,
      error: {
        code: 'REVIEW_FAILED',
        message: error.message || '审核失败，请稍后重试'
      }
    };
  }
}
