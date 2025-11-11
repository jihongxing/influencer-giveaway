// 数据库迁移云函数
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
  const { action } = event;
  const { OPENID } = cloud.getWXContext();

  try {
    switch (action) {
      case 'mergeItems':
        return await mergeItems();
      default:
        // 默认执行数据库初始化检查
        return await initDatabase();
    }
  } catch (error) {
    console.error('Migration function error:', error);
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
 * 初始化数据库（检查集合是否存在）
 */
async function initDatabase() {
  console.log('[数据库初始化] 开始检查...');
  
  try {
    const collections = ['activities', 'items', 'orders', 'users', 'payments'];
    const results = [];

    for (const collectionName of collections) {
      try {
        const count = await db.collection(collectionName).count();
        results.push({
          collection: collectionName,
          status: 'exists',
          count: count.total
        });
        console.log(`[数据库初始化] ${collectionName} 集合已存在，记录数：${count.total}`);
      } catch (error) {
        results.push({
          collection: collectionName,
          status: 'not_exists',
          error: error.message
        });
        console.log(`[数据库初始化] ${collectionName} 集合不存在或无权限访问`);
      }
    }

    return {
      success: true,
      data: {
        message: '数据库检查完成',
        collections: results
      }
    };
  } catch (error) {
    console.error('[数据库初始化] 错误:', error);
    return {
      success: false,
      error: {
        code: 'INIT_ERROR',
        message: error.message
      }
    };
  }
}

/**
 * 合并物品记录
 * 将多条 quantity=1 的记录合并为一条 marker_quantity=N 的记录
 */
async function mergeItems() {
  console.log('[数据迁移] 开始合并物品记录...');
  
  try {
    // 查找所有标记为批量生成的物品
    const batchItems = await db.collection('items')
      .where({
        is_batch_generated: true
      })
      .get();

    console.log(`[数据迁移] 找到 ${batchItems.data.length} 条批量生成的记录`);

    // 按 batch_id 分组
    const groups = {};
    for (const item of batchItems.data) {
      const key = `${item.batch_id}_${item.activity_id}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    }

    console.log(`[数据迁移] 共 ${Object.keys(groups).length} 个批次需要合并`);

    let mergedCount = 0;
    let deletedCount = 0;

    // 处理每个批次
    for (const [key, items] of Object.entries(groups)) {
      if (items.length <= 1) continue;

      // 对每个批次内的物品，按原始索引分组
      const subGroups = {};
      for (const item of items) {
        // marker_name 格式: ITEM_batch_1_1, ITEM_batch_1_2
        // 提取倒数第二个数字作为索引
        const parts = item.marker_name.split('_');
        const index = parts[parts.length - 2];
        
        if (!subGroups[index]) {
          subGroups[index] = [];
        }
        subGroups[index].push(item);
      }

      // 合并每个子组
      for (const [index, groupItems] of Object.entries(subGroups)) {
        if (groupItems.length <= 1) continue;

        // 使用第一条记录作为基础
        const baseItem = groupItems[0];
        const totalQuantity = groupItems.length;

        // 新的 marker_name（去掉序列号）
        const newMarkerName = baseItem.marker_name.split('_').slice(0, -1).join('_');

        try {
          // 更新第一条记录
          await db.collection('items')
            .doc(baseItem._id)
            .update({
              data: {
                marker_quantity: totalQuantity,
                remaining_quantity: totalQuantity,
                locked_quantity: 0,
                marker_name: newMarkerName,
                is_batch_generated: false,  // 标记为已迁移
                migrated: true,
                migrated_at: db.serverDate(),
                updated_at: db.serverDate()
              }
            });

          mergedCount++;

          // 删除其他记录
          for (let i = 1; i < groupItems.length; i++) {
            await db.collection('items')
              .doc(groupItems[i]._id)
              .remove();
            deletedCount++;
          }

          console.log(`[数据迁移] 合并成功: ${newMarkerName} (${totalQuantity}件)`);
        } catch (error) {
          console.error(`[数据迁移] 合并失败: ${baseItem.marker_name}`, error);
        }
      }
    }

    const result = {
      success: true,
      data: {
        total_batches: Object.keys(groups).length,
        merged_items: mergedCount,
        deleted_items: deletedCount,
        message: `成功合并 ${mergedCount} 个物品，删除 ${deletedCount} 条冗余记录`
      }
    };

    console.log('[数据迁移] 完成:', result.data.message);
    return result;

  } catch (error) {
    console.error('[数据迁移] 错误:', error);
    return {
      success: false,
      error: {
        code: 'MIGRATION_ERROR',
        message: error.message
      }
    };
  }
}
