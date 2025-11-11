// 数据库初始化云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 云函数入口函数 - 初始化数据库集合或运行迁移
 * 参数: { action: 'init' | 'migrate' }
 */
exports.main = async (event, context) => {
  const { action } = event;
  
  // 如果指定运行迁移
  if (action === 'migrate') {
    return await runMigration();
  }
  
  // 默认执行数据库初始化
  return await initDatabase();
};

/**
 * 初始化数据库集合
 */
async function initDatabase() {
  console.log('开始初始化数据库集合...');
  
  // 需要创建的集合列表（根据PRD完整定义）
  const collections = [
    'users',              // 用户集合
    'activities',         // 赠送活动集合
    'items',              // 物品集合
    'orders',             // 订单集合
    'payments',           // 支付记录集合
    'shipping_info',      // 物流信息集合
    'password_errors',    // 密码错误记录集合
    'sharing_posts',      // 晒单集合
    'external_activities' // 外部活动集合
  ];
  
  const collectionResults = [];
  
  try {
    // 逐个创建集合
    for (const collection of collections) {
      try {
        await db.createCollection(collection);
        collectionResults.push({
          collection,
          status: 'success',
          message: `✅ 成功创建集合: ${collection}`
        });
        console.log(`✅ 成功创建集合: ${collection}`);
      } catch (error) {
        // 集合已存在时视为成功
        if (error.errCode === -1 || error.errMsg?.includes('Table exist')) {
          collectionResults.push({
            collection,
            status: 'success',
            message: `✅ 集合 ${collection} 已存在，继续下一步操作`
          });
          console.log(`✅ 集合 ${collection} 已存在，继续下一步操作`);
        } else {
          collectionResults.push({
            collection,
            status: 'error',
            message: `❌ 创建集合 ${collection} 失败: ${error.message}`,
            error
          });
          console.error(`❌ 创建集合 ${collection} 失败:`, error);
        }
      }
    }
    
    // 注意：索引创建需要通过云开发控制台手动创建或使用HTTP API
    // 以下是每个集合需要创建的索引说明
    const indexGuide = getIndexGuide();
    console.log('数据库集合检查完成');
    console.log('请按照以下指引配置手动创建索引：');
    console.log(JSON.stringify(indexGuide, null, 2));
    
    return {
      success: true,
      data: {
        collections,
        collectionResults,
        indexGuide,
        note: '索引创建需要通过云开发控制台手动创建，请按照indexGuide中的配置创建',
        message: '数据库集合检查完成'
      }
    };
  } catch (error) {
    console.error('数据库初始化过程中发生错误:', error);
    return {
      success: false,
      error: {
        code: 'INITIALIZATION_FAILED',
        message: `数据库初始化失败: ${error.message}`
      }
    };
  }
}

/**
 * 运行数据库迁移
 */
async function runMigration() {
  console.log('===== 开始执行数据迁移 =====');
  
  try {
    // 迁移activities
    const activitiesResult = await migrateActivities();
    
    // 迁移items
    const itemsResult = await migrateItems();
    
    console.log('===== 数据迁移完成 =====');
    
    return {
      success: true,
      data: {
        activities: activitiesResult,
        items: itemsResult
      }
    };
  } catch (error) {
    console.error('迁移过程出错:', error);
    return {
      success: false,
      error: {
        code: 'MIGRATION_FAILED',
        message: error.message
      }
    };
  }
}

/**
 * 迁移现有activities数据，添加新字段
 */
async function migrateActivities() {
  console.log('开始迁移activities集合...');
  
  const MAX_LIMIT = 100;
  let total = 0;
  let migrated = 0;
  
  try {
    const countResult = await db.collection('activities').count();
    total = countResult.total;
    console.log(`总共需要迁移 ${total} 条记录`);
    
    if (total === 0) {
      console.log('没有数据需要迁移');
      return { success: true, total: 0, migrated: 0 };
    }
    
    for (let skip = 0; skip < total; skip += MAX_LIMIT) {
      const activities = await db.collection('activities')
        .skip(skip)
        .limit(MAX_LIMIT)
        .get();
      
      console.log(`处理第 ${skip + 1} - ${skip + activities.data.length} 条记录`);
      
      for (const activity of activities.data) {
        try {
          const updateData = { updated_at: db.serverDate() };
          
          if (!activity.title) updateData.title = '赠送活动';
          if (!activity.description) updateData.description = '';
          if (!activity.cover_image_url) updateData.cover_image_url = null;
          if (!activity.source_platform) updateData.source_platform = 'other';
          if (!activity.scheduled_start_time) updateData.scheduled_start_time = null;
          if (activity.is_immediate_publish === undefined) updateData.is_immediate_publish = true;
          if (activity.is_password_protected === undefined) updateData.is_password_protected = false;
          if (!activity.access_password) updateData.access_password = null;
          if (!activity.password_hint) updateData.password_hint = null;
          if (!activity.preferred_courier) updateData.preferred_courier = null;
          if (!activity.sender_address) updateData.sender_address = null;
          if (!activity.sender_contact_name) updateData.sender_contact_name = '';
          if (!activity.sender_contact_phone) updateData.sender_contact_phone = '';
          
          if (activity.total_items_count === undefined) {
            const itemsCount = await db.collection('items')
              .where({ activity_id: activity._id })
              .count();
            updateData.total_items_count = itemsCount.total;
          }
          
          if (activity.available_items_count === undefined) {
            const availableCount = await db.collection('items')
              .where({ activity_id: activity._id, status: 'available' })
              .count();
            updateData.available_items_count = availableCount.total;
          }
          
          if (activity.view_count === undefined) updateData.view_count = 0;
          if (activity.access_attempts === undefined) updateData.access_attempts = 0;
          
          await db.collection('activities').doc(activity._id).update({ data: updateData });
          migrated++;
          
          if (migrated % 10 === 0) {
            console.log(`已迁移 ${migrated}/${total} 条记录`);
          }
        } catch (err) {
          console.error(`迁移活动 ${activity._id} 失败:`, err);
        }
      }
    }
    
    console.log(`迁移完成! 总共: ${total}, 成功: ${migrated}`);
    return { success: true, total, migrated };
    
  } catch (error) {
    console.error('迁移失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 获取索引创建指南
 * 返回每个集合需要创建的索引配置
 */
function getIndexGuide() {
  return {
    users: [
      {
        name: 'openid_index',
        field: 'openid',
        type: 'unique',
        description: '用户openid唯一索引，用于快速查找用户'
      },
      {
        name: 'phone_index',
        field: 'phone_number',
        type: 'normal',
        description: '手机号索引'
      },
      {
        name: 'role_index',
        field: 'role',
        type: 'normal',
        description: '角色索引（influencer/fan）'
      }
    ],
    activities: [
      {
        name: 'influencer_id_index',
        field: 'influencer_id',
        type: 'normal',
        description: '主播ID索引，用于查询主播的所有活动'
      },
      {
        name: 'status_index',
        field: 'status',
        type: 'normal',
        description: '活动状态索引（active/completed/cancelled）'
      },
      {
        name: 'influencer_status_compound',
        fields: ['influencer_id', 'status'],
        type: 'compound',
        description: '主播ID+状态复合索引，查询效率更高'
      },
      {
        name: 'created_at_index',
        field: 'created_at',
        type: 'normal',
        description: '创建时间索引，用于排序'
      }
    ],
    items: [
      {
        name: 'activity_id_index',
        field: 'activity_id',
        type: 'normal',
        description: '活动ID索引，用于查询活动的所有物品'
      },
      {
        name: 'status_index',
        field: 'status',
        type: 'normal',
        description: '物品状态索引（available/claimed/shipped）'
      },
      {
        name: 'activity_status_compound',
        fields: ['activity_id', 'status'],
        type: 'compound',
        description: '活动ID+状态复合索引'
      },
      {
        name: 'item_number_index',
        field: 'item_number',
        type: 'normal',
        description: '5位数字编号索引'
      }
    ],
    orders: [
      {
        name: 'activity_id_index',
        field: 'activity_id',
        type: 'normal',
        description: '活动ID索引'
      },
      {
        name: 'fan_wechat_openid_index',
        field: 'fan_wechat_openid',
        type: 'normal',
        description: '粉丝openid索引，用于查询用户订单'
      },
      {
        name: 'payment_status_index',
        field: 'payment_status',
        type: 'normal',
        description: '支付状态索引（pending/paid/failed/refunded）'
      },
      {
        name: 'order_status_index',
        field: 'order_status',
        type: 'normal',
        description: '订单状态索引（pending/processing/shipped/completed）'
      },
      {
        name: 'payment_deadline_index',
        field: 'payment_deadline',
        type: 'normal',
        description: '支付截止时间索引，用于超时检查'
      },
      {
        name: 'created_at_index',
        field: 'created_at',
        type: 'normal',
        description: '创建时间索引'
      }
    ],
    payments: [
      {
        name: 'order_id_index',
        field: 'order_id',
        type: 'normal',
        description: '订单ID索引'
      },
      {
        name: 'transaction_id_index',
        field: 'transaction_id',
        type: 'unique',
        description: '微信交易号唯一索引'
      },
      {
        name: 'fan_openid_index',
        field: 'fan_openid',
        type: 'normal',
        description: '粉丝openid索引'
      },
      {
        name: 'status_index',
        field: 'status',
        type: 'normal',
        description: '支付状态索引'
      }
    ],
    shipping_info: [
      {
        name: 'order_id_index',
        field: 'order_id',
        type: 'unique',
        description: '订单ID唯一索引，一个订单对应一条物流信息'
      },
      {
        name: 'tracking_number_index',
        field: 'tracking_number',
        type: 'normal',
        description: '运单号索引'
      },
      {
        name: 'courier_company_index',
        field: 'courier_company',
        type: 'normal',
        description: '快递公司索引'
      },
      {
        name: 'logistics_status_index',
        field: 'logistics_status',
        type: 'normal',
        description: '物流状态索引'
      }
    ],
    password_errors: [
      {
        name: 'activity_user_compound',
        fields: ['activity_id', 'user_openid'],
        type: 'compound',
        description: '活动ID+用户openid复合索引，用于快速查询错误次数'
      },
      {
        name: 'created_at_index',
        field: 'created_at',
        type: 'normal',
        description: '创建时间索引，用于清理过期记录'
      }
    ],
    sharing_posts: [
      {
        name: 'order_id_index',
        field: 'order_id',
        type: 'normal',
        description: '订单ID索引'
      },
      {
        name: 'activity_id_index',
        field: 'activity_id',
        type: 'normal',
        description: '活动ID索引'
      },
      {
        name: 'user_openid_index',
        field: 'user_openid',
        type: 'normal',
        description: '用户openid索引'
      },
      {
        name: 'created_at_index',
        field: 'created_at',
        type: 'normal',
        description: '创建时间索引，用于按时间排序'
      }
    ],
    external_activities: [
      {
        name: 'influencer_id_index',
        field: 'influencer_id',
        type: 'normal',
        description: '主播ID索引'
      },
      {
        name: 'activity_time_index',
        field: 'activity_time',
        type: 'normal',
        description: '活动时间索引'
      }
    ]
  };
}

/**
 * 迁移现有items数据，添加批量相关字段
 */
async function migrateItems() {
  console.log('开始迁移items集合...');
  
  const MAX_LIMIT = 100;
  let total = 0;
  let migrated = 0;
  
  try {
    const countResult = await db.collection('items').count();
    total = countResult.total;
    console.log(`总共需要迁移 ${total} 条记录`);
    
    if (total === 0) {
      console.log('没有数据需要迁移');
      return { success: true, total: 0, migrated: 0 };
    }
    
    for (let skip = 0; skip < total; skip += MAX_LIMIT) {
      const items = await db.collection('items')
        .skip(skip)
        .limit(MAX_LIMIT)
        .get();
      
      console.log(`处理第 ${skip + 1} - ${skip + items.data.length} 条记录`);
      
      for (const item of items.data) {
        try {
          const updateData = { updated_at: db.serverDate() };
          
          if (!item.batch_id) updateData.batch_id = `legacy_${item._id}`;
          if (item.sequence_number === undefined) updateData.sequence_number = 1;
          if (item.original_quantity === undefined) updateData.original_quantity = 1;
          if (item.is_batch_generated === undefined) updateData.is_batch_generated = false;
          
          await db.collection('items').doc(item._id).update({ data: updateData });
          migrated++;
          
          if (migrated % 10 === 0) {
            console.log(`已迁移 ${migrated}/${total} 条记录`);
          }
        } catch (err) {
          console.error(`迁移物品 ${item._id} 失败:`, err);
        }
      }
    }
    
    console.log(`迁移完成! 总共: ${total}, 成功: ${migrated}`);
    return { success: true, total, migrated };
    
  } catch (error) {
    console.error('迁移失败:', error);
    return { success: false, error: error.message };
  }
}