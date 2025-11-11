// 物品管理云函数
const cloud = require('wx-server-sdk');
const axios = require('axios');

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
      case 'create':  // 新增：创建单个物品
        return await createItem(OPENID, data);
      case 'processPhotos':
        return await processPhotos(OPENID, data);
      case 'batchUpload':
        return await batchUpload(OPENID, data);
      case 'update':
        return await updateItem(OPENID, data);
      case 'delete':  // 新增：删除物品
        return await deleteItem(OPENID, data);
      case 'getDetail':
        return await getItemDetail(data);
      case 'getList':  // 新增：获取物品列表
        return await getItemList(data);
      case 'batchUpdate':
        return await batchUpdateItems(OPENID, data);
      case 'reserveStock':  // 新增：预留库存
        return await reserveStock(data);
      case 'releaseStock':  // 新增：释放库存
        return await releaseStock(data);
      case 'reduceStock':  // 新增：扣减库存
        return await reduceStock(data);
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
    console.error('Items function error:', error);
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
 * 批量上传物品（支持数量批量生成）
 */
async function batchUpload(openid, data) {
  const { activity_id, items_data, marker_prefix } = data;

  // 验证活动所有权
  const activity = await db.collection('activities')
    .doc(activity_id)
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

  if (!items_data || items_data.length === 0) {
    return {
      success: false,
      error: {
        code: 'NO_ITEMS',
        message: '请添加至少一个物品'
      }
    };
  }

  // 限制单次最大数量
  const totalQuantity = items_data.reduce((sum, item) => sum + (item.quantity || 1), 0);
  if (totalQuantity > 100) {
    return {
      success: false,
      error: {
        code: 'TOO_MANY_ITEMS',
        message: '单次最多上传100件物品'
      }
    };
  }

  const batch_id = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const created_items = [];

  console.log('[batchUpload] 开始批量上传, 物品数量:', items_data.length);
  console.log('[batchUpload] 第一个物品数据:', JSON.stringify(items_data[0]));

  // 遍历每个物品数据（每张照片）
  for (let i = 0; i < items_data.length; i++) {
    const item_data = items_data[i];
    const { 
      photo_urls, 
      quantity, 
      ai_category, 
      ai_tags,
      shipping_cost_estimate,
      label 
    } = item_data;

    const qty = quantity || 1;

    console.log(`[batchUpload] 处理第${i + 1}个物品, ai_category: ${ai_category}, label: ${label}`);

    // 每张照片生成一条记录，数量记录在 marker_quantity 字段
    const marker_name = `${marker_prefix || 'ITEM'}_${batch_id}_${i + 1}`;
    const qr_code_data = `marker_${activity_id}_${marker_name}`;

    const result = await db.collection('items').add({
      data: {
        activity_id,
        photo_urls: photo_urls || [],
        ai_category: ai_category || 'uncategorized',
        ai_tags: ai_tags || [],
        label: label || '',
        marker_name,
        marker_quantity: qty,  // 库存数量
        remaining_quantity: qty,  // 剩余数量（新增字段）
        marker_notes: '',
        batch_id,
        shipping_cost_estimate: shipping_cost_estimate || 10.0,
        base_shipping_cost: calculateBaseShippingCost(ai_category || 'other'),  // 基础运费
        status: 'available',
        qr_code_data,
        created_at: db.serverDate(),
        updated_at: db.serverDate()
      }
    });

    created_items.push({
      item_id: result._id,
      marker_name,
      quantity: qty
    });
  }

  // 更新活动的物品统计（按条目数，不是总数量）
  await db.collection('activities')
    .doc(activity_id)
    .update({
      data: {
        total_items_count: _.inc(created_items.length),
        available_items_count: _.inc(created_items.length),
        updated_at: db.serverDate()
      }
    });

  return {
    success: true,
    data: {
      batch_id,
      created_count: created_items.length,
      items: created_items
    }
  };
}

/**
 * 处理上传的照片（调用AI识别云函数）
 */
async function processPhotos(openid, data) {
  const { files, start_index = 0 } = data;

  if (!files || files.length === 0) {
    return {
      success: false,
      error: {
        code: 'NO_FILES',
        message: '没有提供文件'
      }
    };
  }

  console.log('[processPhotos] 处理照片, 文件数量:', files.length, '起始编号:', start_index);

  try {
    // 获取文件的临时链接，设置最大过期时间为24小时
  const tempFileURLs = await cloud.getTempFileURL({
    fileList: files,
    maxAge: 86400 // 24小时有效期，单位秒
  });

    console.log('[processPhotos] 获取临时链接成功:', tempFileURLs.fileList.length);

    // 检查临时链接是否有效
    const validTempFileURLs = tempFileURLs.fileList.filter(file => {
      if (file.status !== 0 || !file.tempFileURL) {
        console.error('[processPhotos] 文件临时链接获取失败:', file.fileID, 'status:', file.status, 'errMsg:', file.errMsg);
        return false;
      }
      
      // 检查链接是否包含签名
      if (!file.tempFileURL.includes('sign=')) {
        console.error('[processPhotos] 临时链接缺少签名:', file.fileID);
        return false;
      }
      
      // 检查链接是否过期
      try {
        // 使用正则表达式提取时间戳，避免URL构造函数问题
        const timestampMatch = file.tempFileURL.match(/[?&]t=(\d+)/);
        if (timestampMatch) {
          const timestamp = parseInt(timestampMatch[1]);
          const currentTime = Math.floor(Date.now() / 1000);
          
          if ((currentTime - timestamp) > 86400) {
            console.warn('[processPhotos] 临时链接可能已过期:', file.fileID);
          }
        } else {
          console.warn('[processPhotos] 临时链接缺少时间戳:', file.fileID);
        }
      } catch (urlError) {
        console.error('[processPhotos] 解析临时链接URL失败:', file.tempFileURL, urlError);
        return false;
      }
      
      return true;
    });
    
    if (validTempFileURLs.length === 0) {
      throw new Error('所有图片的临时链接获取失败');
    }
    
    if (validTempFileURLs.length < tempFileURLs.fileList.length) {
      console.warn('[processPhotos] 部分图片临时链接获取失败，将继续处理有效图片');
    }

    // 调用AI识别云函数处理每个文件
    const processPromises = tempFileURLs.fileList.map(async (fileInfo, index) => {
      const itemNumber = start_index + index + 1;
      
      try {
        // 调用AI识别云函数
        console.log(`[processPhotos] 调用AI识别云函数，物品${itemNumber}`);
        console.log(`[processPhotos] 图片URL: ${fileInfo.tempFileURL}`);
        
        // 下载图片并转换为base64
        let imageBase64;
        try {
          imageBase64 = await downloadAndEncodeImage(fileInfo.tempFileURL);
          console.log(`[processPhotos] 图片下载成功, Base64长度: ${imageBase64.length}`);
        } catch (downloadError) {
          console.error(`[processPhotos] 图片下载失败:`, downloadError);
          throw new Error('图片下载失败: ' + downloadError.message);
        }
        
        // 调用百度AI识别
        const recognizeResult = await cloud.callFunction({
          name: 'ai-recognition',
          data: {
            action: 'recognizeImage',
            data: {
              image: imageBase64,
              image_type: 'BASE64'
            }
          }
        });

        console.log(`[processPhotos] 百度AI识别结果:`, JSON.stringify(recognizeResult.result));

        let aiCategory = 'other';
        let aiTags = ['未分类'];
        let confidence = 0;
        let suggestedLabel = `物品 ${itemNumber}`;

        // 检查识别结果
        if (recognizeResult.result && recognizeResult.result.success && recognizeResult.result.data) {
          const baiduResults = recognizeResult.result.data.results || [];
          
          console.log(`[processPhotos] 百度返回结果数量: ${baiduResults.length}`);
          
          if (baiduResults.length > 0) {
            console.log(`[processPhotos] 顶部结果:`, JSON.stringify(baiduResults[0]));
            
            // 调用类别映射云函数
            const mapResult = await cloud.callFunction({
              name: 'ai-recognition',
              data: {
                action: 'mapCategory',
                data: {
                  baiduResults: baiduResults
                }
              }
            });

            console.log(`[processPhotos] 类别映射结果:`, JSON.stringify(mapResult.result));

            if (mapResult.result && mapResult.result.success && mapResult.result.data) {
              aiCategory = mapResult.result.data.category || 'other';
              aiTags = mapResult.result.data.tags || ['未分类'];
              confidence = mapResult.result.data.confidence || 0;
              suggestedLabel = baiduResults[0].keyword || `物品 ${itemNumber}`;
            }
          } else {
            console.warn(`[processPhotos] 百度AI未返回任何识别结果`);
          }
        } else {
          console.error(`[processPhotos] AI识别失败:`, recognizeResult.result?.error);
        }
        
        // 计算运费
        const baseShippingCost = calculateBaseShippingCost(aiCategory);
        const packagingCost = 2.0;
        const totalShippingCost = baseShippingCost + packagingCost;

        console.log(`[processPhotos] 物品${itemNumber} - 类别: ${aiCategory}, 标签: ${aiTags.join(',')}, 置信度: ${confidence}`);

        return {
          temp_id: `temp_${Date.now()}_${index}`,
          ai_category: aiCategory,
          ai_tags: aiTags,
          confidence: confidence,
          shipping_cost_estimate: totalShippingCost,
          photo_urls: [fileInfo.tempFileURL],
          suggested_label: suggestedLabel
        };
      } catch (error) {
        console.error(`[processPhotos] 处理物品${itemNumber}失败:`, error);
        // 出错时使用默认值
        return {
          temp_id: `temp_${Date.now()}_${index}`,
          ai_category: 'other',
          ai_tags: ['未分类'],
          confidence: 0,
          shipping_cost_estimate: 12.0,
          photo_urls: [fileInfo.tempFileURL],
          suggested_label: `物品 ${itemNumber}`
        };
      }
    });

    const processedItems = await Promise.all(processPromises);

    console.log('[processPhotos] 处理完成, 物品数量:', processedItems.length);

    return {
      success: true,
      data: {
        items: processedItems
      }
    };
  } catch (error) {
    console.error('[processPhotos] 处理照片失败:', error);
    return {
      success: false,
      error: {
        code: 'PROCESS_FAILED',
        message: `处理失败: ${error.message}`
      }
    };
  }
}

/**
 * 基于规则识别物品类别（从文件名提取特征）
 * @param {string} fileName - 文件名或文件路径
 * @returns {object} - { category, tags, confidence, label }
 */
function recognizeItemByRules(fileName) {
  // 规则匹配表：关键词 -> 类别
  const rules = [
    // 鞋类
    {
      keywords: ['鞋', 'shoe', 'shoes', '运动鞋', '皮鞋', '凉鞋', '靴子', '拖鞋', 'sneaker', 'boot'],
      category: 'shoes',
      tags: ['鞋类', '服饰'],
      label: '鞋子'
    },
    // 衣物
    {
      keywords: ['衣服', '衣', 'cloth', '衬衫', 't-shirt', 'tshirt', '外套', '裤子', '裙子', 'jacket', 'coat'],
      category: 'clothing',
      tags: ['衣物', '服饰'],
      label: '衣服'
    },
    // 电子产品
    {
      keywords: ['手机', 'phone', '电脑', 'computer', '耳机', 'headphone', '数码', 'digital', '充电', 'charger'],
      category: 'electronics',
      tags: ['电子产品', '数码'],
      label: '电子产品'
    },
    // 书籍
    {
      keywords: ['书', 'book', '教材', '小说', '杂志', 'magazine'],
      category: 'books',
      tags: ['书籍', '阅读'],
      label: '书籍'
    },
    // 美妆
    {
      keywords: ['化妆品', '美妆', 'makeup', '口红', 'lipstick', '香水', 'perfume', '护肤', 'skincare'],
      category: 'cosmetics',
      tags: ['美妆', '护肤'],
      label: '美妆产品'
    },
    // 玩具
    {
      keywords: ['玩具', 'toy', '模型', 'model', '公仔', 'figure', '乐高', 'lego'],
      category: 'toys',
      tags: ['玩具', '收藏'],
      label: '玩具'
    },
    // 包包
    {
      keywords: ['包', 'bag', '背包', 'backpack', '手提包', '钱包', 'wallet'],
      category: 'bags',
      tags: ['包包', '配饰'],
      label: '包包'
    },
    // 食品
    {
      keywords: ['零食', 'snack', '食品', 'food', '糖果', 'candy', '饬头', 'cookie'],
      category: 'food',
      tags: ['食品', '零食'],
      label: '食品'
    },
    // 文具
    {
      keywords: ['文具', 'stationery', '笔', 'pen', '本子', 'notebook', '橡皮', 'eraser'],
      category: 'stationery',
      tags: ['文具', '办公'],
      label: '文具'
    },
    // 家居
    {
      keywords: ['家居', 'home', '装饰', 'decoration', '毛巾', 'towel', '枕头', 'pillow'],
      category: 'home',
      tags: ['家居', '生活用品'],
      label: '家居用品'
    }
  ];

  // 遍历规则进行匹配
  for (const rule of rules) {
    for (const keyword of rule.keywords) {
      if (fileName.includes(keyword)) {
        return {
          category: rule.category,
          tags: rule.tags,
          confidence: 0.8, // 规则匹配的置信度
          label: rule.label
        };
      }
    }
  }

  // 未匹配到任何规则，返回 other
  return {
    category: 'other',
    tags: ['未分类'],
    confidence: 0,
    label: ''
  };
}

/**
 * 下载图片并转换为base64（优化：添加超时控制）
 * @param {string} imageUrl - 图片URL
 * @returns {Promise<string>} base64编码的图片
 */
async function downloadAndEncodeImage(imageUrl) {
  try {
    console.log('[downloadAndEncodeImage] 开始下载:', imageUrl.substring(0, 100));
    const startTime = Date.now();
    
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 8000,  // 8秒超时
      maxContentLength: 5 * 1024 * 1024  // 最大5MB
    });
    
    const downloadTime = Date.now() - startTime;
    console.log(`[downloadAndEncodeImage] 下载完成，耗时: ${downloadTime}ms, 大小: ${response.data.length} bytes`);
    
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    console.log(`[downloadAndEncodeImage] Base64转换完成，长度: ${base64.length}`);
    
    return base64;
  } catch (error) {
    console.error('[downloadAndEncodeImage] 失败:', error.message);
    throw new Error('图片下载失败: ' + error.message);
  }
}

/**
 * 计算基础运费（根据物品类别）
 * 运费算法：
 * - 小件：8元
 * - 中件：12元
 * - 大件：18元
 * - 特大件：25元
 * - 默认：10元
 */
function calculateBaseShippingCost(category) {
  const shippingRates = {
    'small': 8.0,      // 小件：文具、饮品、化妆品等
    'medium': 12.0,    // 中件：衣物、鞋子、玩具等
    'large': 18.0,     // 大件：包、小家电等
    'xlarge': 25.0,    // 特大件：大型物品
    'other': 10.0      // 默认
  };

  return shippingRates[category] || shippingRates['other'];
}

/**
 * 更新物品信息
 */
async function updateItem(openid, data) {
  const { item_id, ...updateData } = data;

  // 检查物品是否存在
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

  // 检查权限（通过活动检查）
  const activityResult = await db.collection('activities')
    .doc(itemResult.data.activity_id)
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

  // 更新物品
  await db.collection('items')
    .doc(item_id)
    .update({
      data: {
        ...updateData,
        updated_at: db.serverDate()
      }
    });

  return {
    success: true,
    data: {
      item_id
    }
  };
}

/**
 * 批量更新物品
 */
async function batchUpdateItems(openid, data) {
  const { items } = data; // items: [{item_id, ...updateData}, ...]

  if (!items || items.length === 0) {
    return {
      success: false,
      error: {
        code: 'NO_ITEMS',
        message: 'No items provided'
      }
    };
  }

  // 验证所有物品都属于当前用户
  const itemIds = items.map(item => item.item_id);
  const itemsResult = await db.collection('items')
    .where({
      _id: _.in(itemIds)
    })
    .get();

  // 检查权限
  const activityIds = [...new Set(itemsResult.data.map(item => item.activity_id))];
  const activitiesResult = await db.collection('activities')
    .where({
      _id: _.in(activityIds),
      influencer_id: openid
    })
    .get();

  if (activitiesResult.data.length !== activityIds.length) {
    return {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: 'Some items do not belong to you'
      }
    };
  }

  // 批量更新
  const updatePromises = items.map(item => {
    const { item_id, ...updateData } = item;
    return db.collection('items')
      .doc(item_id)
      .update({
        data: {
          ...updateData,
          updated_at: db.serverDate()
        }
      });
  });

  await Promise.all(updatePromises);

  return {
    success: true,
    data: {
      updated_count: items.length
    }
  };
}

/**
 * 获取物品详情
 */
async function getItemDetail(data) {
  const { item_id } = data;

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

  return {
    success: true,
    data: itemResult.data
  };
}

/**
 * 创建单个物品
 */
async function createItem(openid, data) {
  const {
    activity_id,
    photo_urls = [],
    ai_category = 'other',
    ai_tags = [],
    label = '',
    marker_name,
    marker_quantity = 1,
    marker_notes = '',
    shipping_cost_estimate
  } = data;

  // 验证活动所有权
  const activity = await db.collection('activities')
    .doc(activity_id)
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

  // 计算运费
  const base_shipping_cost = calculateBaseShippingCost(ai_category);
  const final_shipping_cost = shipping_cost_estimate || (base_shipping_cost + 2.0);

  // 创建物品
  const result = await db.collection('items').add({
    data: {
      activity_id,
      photo_urls,
      ai_category,
      ai_tags,
      label,
      marker_name: marker_name || `ITEM_${Date.now()}`,
      marker_quantity,
      remaining_quantity: marker_quantity,  // 初始剩余量 = 总量
      marker_notes,
      shipping_cost_estimate: final_shipping_cost,
      base_shipping_cost,
      status: 'available',
      created_at: db.serverDate(),
      updated_at: db.serverDate()
    }
  });

  // 更新活动统计
  await db.collection('activities')
    .doc(activity_id)
    .update({
      data: {
        total_items_count: _.inc(1),
        available_items_count: _.inc(1),
        updated_at: db.serverDate()
      }
    });

  return {
    success: true,
    data: {
      item_id: result._id
    }
  };
}

/**
 * 删除物品
 */
async function deleteItem(openid, data) {
  const { item_id } = data;

  // 检查物品是否存在
  const itemResult = await db.collection('items')
    .doc(item_id)
    .get();

  if (!itemResult.data) {
    return {
      success: false,
      error: {
        code: 'ITEM_NOT_FOUND',
        message: '物品不存在'
      }
    };
  }

  const item = itemResult.data;

  // 检查权限（通过活动检查）
  const activityResult = await db.collection('activities')
    .doc(item.activity_id)
    .get();

  if (!activityResult.data || activityResult.data.influencer_id !== openid) {
    return {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: '无权限操作'
      }
    };
  }

  // 检查是否已有订单
  const ordersResult = await db.collection('orders')
    .where({
      item_id: item_id,
      order_status: _.neq('cancelled')
    })
    .count();

  if (ordersResult.total > 0) {
    return {
      success: false,
      error: {
        code: 'HAS_ORDERS',
        message: '该物品已有订单，无法删除'
      }
    };
  }

  // 删除物品
  await db.collection('items')
    .doc(item_id)
    .remove();

  // 更新活动统计
  const updateData = {
    total_items_count: _.inc(-1),
    updated_at: db.serverDate()
  };

  if (item.status === 'available') {
    updateData.available_items_count = _.inc(-1);
  }

  await db.collection('activities')
    .doc(item.activity_id)
    .update({
      data: updateData
    });

  return {
    success: true,
    data: {
      item_id
    }
  };
}

/**
 * 获取物品列表
 */
async function getItemList(data) {
  const { activity_id, status, page = 1, limit = 20 } = data;

  let whereCondition = { activity_id };
  
  if (status && status !== 'all') {
    whereCondition.status = status;
  }

  const result = await db.collection('items')
    .where(whereCondition)
    .orderBy('created_at', 'desc')
    .skip((page - 1) * limit)
    .limit(limit)
    .get();

  const countResult = await db.collection('items')
    .where(whereCondition)
    .count();

  return {
    success: true,
    data: {
      items: result.data,
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
 * 预留库存（用户下单时调用）
 * 不直接扣减，只检查库存是否充足
 */
async function reserveStock(data) {
  const { item_id, quantity = 1 } = data;

  const item = await db.collection('items')
    .doc(item_id)
    .get();

  if (!item.data) {
    return {
      success: false,
      error: {
        code: 'ITEM_NOT_FOUND',
        message: '物品不存在'
      }
    };
  }

  const remainingQty = item.data.remaining_quantity || 0;

  if (remainingQty < quantity) {
    return {
      success: false,
      error: {
        code: 'INSUFFICIENT_STOCK',
        message: `库存不足，剩余${remainingQty}件`,
        remaining_quantity: remainingQty
      }
    };
  }

  return {
    success: true,
    data: {
      item_id,
      remaining_quantity: remainingQty,
      can_reserve: true
    }
  };
}

/**
 * 扣减库存（支付成功后调用）
 */
async function reduceStock(data) {
  const { item_id, quantity = 1 } = data;

  try {
    // 使用事务保证原子性
    const item = await db.collection('items')
      .doc(item_id)
      .get();

    if (!item.data) {
      return {
        success: false,
        error: {
          code: 'ITEM_NOT_FOUND',
          message: '物品不存在'
        }
      };
    }

    const remainingQty = item.data.remaining_quantity || 0;

    if (remainingQty < quantity) {
      return {
        success: false,
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: `库存不足，剩余${remainingQty}件`
        }
      };
    }

    const newRemainingQty = remainingQty - quantity;

    // 扣减库存
    await db.collection('items')
      .doc(item_id)
      .update({
        data: {
          remaining_quantity: newRemainingQty,
          status: newRemainingQty > 0 ? 'available' : 'claimed',
          updated_at: db.serverDate()
        }
      });

    // 如果库存为0，更新活动的可用物品数
    if (newRemainingQty === 0) {
      await db.collection('activities')
        .doc(item.data.activity_id)
        .update({
          data: {
            available_items_count: _.inc(-1),
            updated_at: db.serverDate()
          }
        });
    }

    return {
      success: true,
      data: {
        item_id,
        remaining_quantity: newRemainingQty,
        status: newRemainingQty > 0 ? 'available' : 'claimed'
      }
    };
  } catch (error) {
    console.error('Reduce stock error:', error);
    return {
      success: false,
      error: {
        code: 'REDUCE_STOCK_FAILED',
        message: error.message || '扣减库存失败'
      }
    };
  }
}

/**
 * 释放库存（订单取消或超时时调用）
 */
async function releaseStock(data) {
  const { item_id, quantity = 1 } = data;

  try {
    const item = await db.collection('items')
      .doc(item_id)
      .get();

    if (!item.data) {
      return {
        success: false,
        error: {
          code: 'ITEM_NOT_FOUND',
          message: '物品不存在'
        }
      };
    }

    const currentRemainingQty = item.data.remaining_quantity || 0;
    const wasOutOfStock = currentRemainingQty === 0;
    const newRemainingQty = currentRemainingQty + quantity;

    // 释放库存
    await db.collection('items')
      .doc(item_id)
      .update({
        data: {
          remaining_quantity: newRemainingQty,
          status: 'available',  // 恢复为可用
          updated_at: db.serverDate()
        }
      });

    // 如果之前库存为0，现在恢复了，更新活动统计
    if (wasOutOfStock) {
      await db.collection('activities')
        .doc(item.data.activity_id)
        .update({
          data: {
            available_items_count: _.inc(1),
            updated_at: db.serverDate()
          }
        });
    }

    return {
      success: true,
      data: {
        item_id,
        remaining_quantity: newRemainingQty,
        status: 'available'
      }
    };
  } catch (error) {
    console.error('Release stock error:', error);
    return {
      success: false,
      error: {
        code: 'RELEASE_STOCK_FAILED',
        message: error.message || '释放库存失败'
      }
    };
  }
}

