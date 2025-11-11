// 48小时发货提醒定时器云函数
// 每6小时执行一次，检查超过48小时未发货的订单
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
  console.log('[48小时发货提醒] 开始执行...');
  
  try {
    // 调用shipping云函数检查待发货订单
    const result = await cloud.callFunction({
      name: 'shipping',
      data: {
        action: 'checkPendingShipments'
      }
    });

    console.log('[48小时发货提醒] 检查结果:', result.result);

    if (result.result.success && result.result.data.reminders.length > 0) {
      // 发送提醒通知
      const reminders = result.result.data.reminders;
      
      for (const reminder of reminders) {
        // 这里可以调用微信模板消息API发送提醒
        // 或者记录到数据库供小程序端查询
        console.log(`[48小时发货提醒] 订单 ${reminder.order_id} 已超时 ${reminder.hours_overdue} 小时`);
        
        // 可选：创建提醒记录
        try {
          await db.collection('shipping_reminders').add({
            data: {
              order_id: reminder.order_id,
              activity_id: reminder.activity_id,
              influencer_id: reminder.influencer_id,
              reminder_type: '48_hour_shipping',
              hours_overdue: reminder.hours_overdue,
              status: 'pending',  // pending/sent/resolved
              created_at: db.serverDate()
            }
          });
        } catch (error) {
          console.error('[48小时发货提醒] 创建提醒记录失败:', error);
        }
      }
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        ...result.result.data,
        message: '48小时发货提醒检查完成'
      }
    };

  } catch (error) {
    console.error('[48小时发货提醒] 执行错误:', error);
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
