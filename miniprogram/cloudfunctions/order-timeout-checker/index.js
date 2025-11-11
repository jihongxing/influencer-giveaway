// 订单超时检查定时器云函数
// 每5分钟执行一次，自动取消超过15分钟未支付的订单
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 云函数入口函数
 * 定时触发器配置：每5分钟执行一次
 * Cron表达式: 0 0/5 * * * * *
 */
exports.main = async (event, context) => {
  console.log('[订单超时检查] 开始执行...');
  
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

    console.log(`[订单超时检查] 找到${expiredOrders.data.length}个超时订单`);

    let cancelledCount = 0;
    let failedCount = 0;

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
        
        console.log(`[订单超时检查] 订单 ${order._id} 已取消`);
      } catch (error) {
        await transaction.rollback();
        failedCount++;
        console.error(`[订单超时检查] 订单 ${order._id} 取消失败:`, error);
      }
    }

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        total_expired: expiredOrders.data.length,
        cancelled: cancelledCount,
        failed: failedCount,
        message: `成功取消${cancelledCount}个超时订单，失败${failedCount}个`
      }
    };

    console.log('[订单超时检查] 执行完成:', result);
    return result;

  } catch (error) {
    console.error('[订单超时检查] 执行错误:', error);
    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    };
  }
};
