// 物流跟踪定时器云函数
// 每6小时执行一次，自动更新未签收订单的物流信息
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 云函数入口函数
 * 定时触发器配置：每6小时执行一次
 * Cron表达式: 0 0 0/6 * * * *
 */
exports.main = async (event, context) => {
  console.log('[物流跟踪定时器] 开始执行...');
  
  try {
    // 查询所有未签收的物流信息
    const shippingRecords = await db.collection('shipping_info')
      .where({
        tracking_status: _.neq('delivered')  // 未签收的
      })
      .get();

    console.log(`[物流跟踪定时器] 找到${shippingRecords.data.length}个待跟踪物流`);

    let updatedCount = 0;
    let deliveredCount = 0;
    let failedCount = 0;

    // 逐个更新物流信息
    for (const shipping of shippingRecords.data) {
      try {
        // 调用shipping云函数更新物流
        const result = await cloud.callFunction({
          name: 'shipping',
          data: {
            action: 'updateTracking',
            data: {
              shipping_info_id: shipping._id
            }
          }
        });

        if (result.result.success) {
          updatedCount++;
          if (result.result.data.tracking_status === 'delivered') {
            deliveredCount++;
            console.log(`[物流跟踪定时器] 订单 ${shipping.order_id} 已签收`);
          }
        } else {
          failedCount++;
          console.error(`[物流跟踪定时器] 更新失败:`, shipping._id, result.result.error);
        }
      } catch (error) {
        failedCount++;
        console.error(`[物流跟踪定时器] 处理失败:`, shipping._id, error);
      }
    }

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        total_records: shippingRecords.data.length,
        updated: updatedCount,
        delivered: deliveredCount,
        failed: failedCount,
        message: `成功更新${updatedCount}个物流，其中${deliveredCount}个已签收，${failedCount}个失败`
      }
    };

    console.log('[物流跟踪定时器] 执行完成:', result);
    return result;

  } catch (error) {
    console.error('[物流跟踪定时器] 执行错误:', error);
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
