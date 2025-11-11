// 迁移脚本: 添加活动元数据字段
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 迁移现有activities数据，添加新字段
 */
async function migrateActivities() {
  console.log('开始迁移activities集合...');
  
  const MAX_LIMIT = 100;
  let total = 0;
  let migrated = 0;
  
  try {
    // 获取总数
    const countResult = await db.collection('activities').count();
    total = countResult.total;
    console.log(`总共需要迁移 ${total} 条记录`);
    
    if (total === 0) {
      console.log('没有数据需要迁移');
      return { success: true, total: 0, migrated: 0 };
    }
    
    // 分批处理
    for (let skip = 0; skip < total; skip += MAX_LIMIT) {
      const activities = await db.collection('activities')
        .skip(skip)
        .limit(MAX_LIMIT)
        .get();
      
      console.log(`处理第 ${skip + 1} - ${skip + activities.data.length} 条记录`);
      
      // 更新每条记录
      for (const activity of activities.data) {
        try {
          const updateData = {
            updated_at: db.serverDate()
          };
          
          // 只添加不存在的字段
          if (!activity.title) {
            updateData.title = '赠送活动';
          }
          
          if (!activity.description) {
            updateData.description = '';
          }
          
          if (!activity.cover_image_url) {
            updateData.cover_image_url = null;
          }
          
          if (!activity.source_platform) {
            updateData.source_platform = 'other';
          }
          
          if (!activity.scheduled_start_time) {
            updateData.scheduled_start_time = null;
          }
          
          if (activity.is_immediate_publish === undefined) {
            updateData.is_immediate_publish = true;
          }
          
          if (activity.is_password_protected === undefined) {
            updateData.is_password_protected = false;
          }
          
          if (!activity.access_password) {
            updateData.access_password = null;
          }
          
          if (!activity.password_hint) {
            updateData.password_hint = null;
          }
          
          if (!activity.preferred_courier) {
            updateData.preferred_courier = null;
          }
          
          if (!activity.sender_address) {
            updateData.sender_address = null;
          }
          
          if (!activity.sender_contact_name) {
            updateData.sender_contact_name = '';
          }
          
          if (!activity.sender_contact_phone) {
            updateData.sender_contact_phone = '';
          }
          
          if (activity.total_items_count === undefined) {
            // 计算实际物品数量
            const itemsCount = await db.collection('items')
              .where({ activity_id: activity._id })
              .count();
            updateData.total_items_count = itemsCount.total;
          }
          
          if (activity.available_items_count === undefined) {
            // 计算可用物品数量
            const availableCount = await db.collection('items')
              .where({ 
                activity_id: activity._id,
                status: 'available'
              })
              .count();
            updateData.available_items_count = availableCount.total;
          }
          
          if (activity.view_count === undefined) {
            updateData.view_count = 0;
          }
          
          if (activity.access_attempts === undefined) {
            updateData.access_attempts = 0;
          }
          
          await db.collection('activities')
            .doc(activity._id)
            .update({
              data: updateData
            });
          
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
          const updateData = {
            updated_at: db.serverDate()
          };
          
          if (!item.batch_id) {
            updateData.batch_id = `legacy_${item._id}`;
          }
          
          if (item.sequence_number === undefined) {
            updateData.sequence_number = 1;
          }
          
          if (item.original_quantity === undefined) {
            updateData.original_quantity = 1;
          }
          
          if (item.is_batch_generated === undefined) {
            updateData.is_batch_generated = false;
          }
          
          await db.collection('items')
            .doc(item._id)
            .update({
              data: updateData
            });
          
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

/**
 * 主函数
 */
exports.main = async (event, context) => {
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
      error: error.message
    };
  }
};
