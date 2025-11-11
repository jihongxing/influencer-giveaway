// 活动管理云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 获取类别中文名称
 */
function getCategoryLabel(category) {
  const categoryLabels = {
    'clothing': '服装',
    'cosmetics': '化妆品',
    'daily': '日用品',
    'food': '食品',
    'electronics': '电子产品',
    'toys': '玩具',
    'stationery': '文具',
    'shoes': '鞋类',
    'bags': '包包',
    'books': '书籍',
    'home': '家居',
    'other': '其他'
  };
  return categoryLabels[category] || '其他';
}

/**
 * 转换单个 fileID 为临时下载链接
 */
async function convertSingleFileId(fileId) {
  if (!fileId || !fileId.startsWith('cloud://')) {
    return fileId;
  }

  try {
    const result = await cloud.getTempFileURL({
      fileList: [fileId]
    });

    if (result.fileList && result.fileList.length > 0) {
      const file = result.fileList[0];
      if (file.status === 0 && file.tempFileURL) {
        return file.tempFileURL;
      }
    }
    
    console.warn('[convertSingleFileId] 转换失败:', fileId);
    return fileId;
  } catch (error) {
    console.error('[convertSingleFileId] 错误:', error);
    return fileId;
  }
}

/**
 * 转换物品图片 fileID 为临时下载链接
 */
async function convertItemPhotoUrls(items) {
  if (!items || items.length === 0) {
    return [];
  }

  // 收集所有需要转换的 fileID
  const allFileIds = [];
  const fileIdMap = {}; // 记录 fileID 在原数组中的位置
  
  items.forEach((item, itemIndex) => {
    if (item.photo_urls && Array.isArray(item.photo_urls)) {
      item.photo_urls.forEach((fileId, urlIndex) => {
        if (fileId && fileId.startsWith('cloud://')) {
          if (!fileIdMap[fileId]) {
            allFileIds.push(fileId);
            fileIdMap[fileId] = [];
          }
          fileIdMap[fileId].push({ itemIndex, urlIndex });
        }
      });
    }
  });

  // 如果没有需要转换的 fileID，直接返回原数据
  if (allFileIds.length === 0) {
    return items;
  }

  try {
    console.log('[convertItemPhotoUrls] 开始转换图片链接，总数:', allFileIds.length);
    
    // 批量获取临时链接，设置最大过期时间为24小时
    const result = await cloud.getTempFileURL({
      fileList: allFileIds,
      maxAge: 86400 // 24小时有效期，单位秒
    });

    console.log('[convertItemPhotoUrls] getTempFileURL 返回结果:', JSON.stringify(result));

    // 创建 fileID 到 tempFileURL 的映射
    const fileIdToTempUrl = {};
    if (result.fileList && Array.isArray(result.fileList)) {
      result.fileList.forEach(file => {
        console.log('[convertItemPhotoUrls] 文件转换结果:', {
          fileID: file.fileID,
          status: file.status,
          tempFileURL: file.tempFileURL
        });
        
        // 检查文件状态和临时链接
        if (file.status === 0 && file.tempFileURL && file.tempFileURL.includes('sign=')) {
          // 检查链接是否有效（包含签名且未过期）
          try {
            // 在云函数环境中可以使用URL构造函数，但为了保持一致性也使用正则表达式
            const timestampMatch = file.tempFileURL.match(/[?&]t=(\d+)/);
            if (timestampMatch) {
              const timestamp = parseInt(timestampMatch[1]);
              const currentTime = Math.floor(Date.now() / 1000);
              
              // 如果时间戳不存在或已过期（超过24小时），记录警告但仍使用链接
              if ((currentTime - timestamp) > 86400) {
                console.warn('[convertItemPhotoUrls] 临时链接可能已过期:', file.fileID);
              }
            } else {
              console.warn('[convertItemPhotoUrls] 临时链接缺少时间戳:', file.fileID);
            }
            
            fileIdToTempUrl[file.fileID] = file.tempFileURL;
          } catch (urlError) {
            console.error('[convertItemPhotoUrls] 解析临时链接URL失败:', file.tempFileURL, urlError);
            fileIdToTempUrl[file.fileID] = file.tempFileURL;
          }
        } else {
          console.error('[convertItemPhotoUrls] 文件转换失败:', file.fileID, 'status:', file.status, 'errMsg:', file.errMsg);
        }
      });
    }

    // 创建新的 items 数组（深拷贝）
    const newItems = JSON.parse(JSON.stringify(items));
    
    // 替换物品中的 fileID 为临时链接
    Object.keys(fileIdMap).forEach(fileId => {
      const tempUrl = fileIdToTempUrl[fileId];
      if (tempUrl) {
        fileIdMap[fileId].forEach(({ itemIndex, urlIndex }) => {
          newItems[itemIndex].photo_urls[urlIndex] = tempUrl;
        });
      } else {
        console.warn('[convertItemPhotoUrls] 未能获取临时链接:', fileId);
        // 保留原始fileID，前端会再次尝试获取临时链接
      }
    });

    console.log('[convertItemPhotoUrls] 转换完成，成功:', Object.keys(fileIdToTempUrl).length, '/', allFileIds.length);
    return newItems;
    
  } catch (error) {
    console.error('[convertItemPhotoUrls] 转换图片链接失败:', error);
    console.error('[convertItemPhotoUrls] 错误堆栈:', error.stack);
    // 转换失败时返回原数据
    return items;
  }
}

/**
 * 云函数入口函数
 */
exports.main = async (event, context) => {
  // 添加调试日志
  console.log('[Activities Cloud Function] Received event:', JSON.stringify(event, null, 2));
  
  // 兼容不同的参数格式
  let action, data;
  
  // 检查 event 本身的结构
  if (event && typeof event === 'object') {
    if (event.action !== undefined) {
      // 标准格式: { action: 'getPublicList', data: {...} }
      action = event.action;
      data = event.data;
    } else if (event.data && event.data.action !== undefined) {
      // 嵌套格式: { data: { action: 'getPublicList', data: {...} } }
      action = event.data.action;
      data = event.data.data;
    } else {
      // 尝试直接从 event 对象中提取
      action = event.action || event.Action || '';
      data = event.data || event.Data || {};
    }
  } else {
    action = '';
    data = {};
  }
  
  console.log('[Activities Cloud Function] Parsed action:', action);
  console.log('[Activities Cloud Function] Parsed data:', JSON.stringify(data, null, 2));
  
  const { OPENID } = cloud.getWXContext(); // 获取用户 openid

  try {
    switch (action) {
      case 'create':
        return await createActivity(OPENID, data);
      case 'createWithMetadata':
        return await createWithMetadata(OPENID, data);
      case 'publish':
        return await publishActivity(OPENID, data);
      case 'verifyPassword':
        return await verifyPassword(data);
      case 'getList':
        return await getActivityList(OPENID, data);
      case 'getPublicList':
        return await getPublicActivityList(data);
      case 'getDetail':
        return await getActivityDetail(data);
      case 'getPublicDetail':
        return await getPublicActivityDetail(data);
      case 'update':
        return await updateActivity(OPENID, data);
      case 'cancel':
        return await cancelActivity(OPENID, data);
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
    console.error('Activities function error:', error);
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
 * 创建活动
 */
async function createActivity(openid, data) {
  const { items, shareable_link } = data;

  // 生成分享链接（如果没有提供）
  const link = shareable_link || generateShareableLink();

  // 创建活动
  const activityResult = await db.collection('activities').add({
    data: {
      influencer_id: openid,
      shareable_link: link,
      status: 'active',
      created_at: db.serverDate(),
      updated_at: db.serverDate()
    }
  });

  // 创建物品
  if (items && items.length > 0) {
    const itemsData = items.map(item => ({
      activity_id: activityResult._id,
      photo_urls: item.photo_urls || [],
      category: item.category || 'other',
      label: item.label || '',
      shipping_cost_estimate: item.shipping_cost_estimate || 0,
      status: 'available',
      marker_name: item.marker_name || null,
      marker_quantity: item.marker_quantity || 1,
      marker_notes: item.marker_notes || null,
      created_at: db.serverDate()
    }));

    await db.collection('items').add({
      data: itemsData
    });
  }

  return {
    success: true,
    data: {
      activity_id: activityResult._id,
      shareable_link: link
    }
  };
}

/**
 * 获取活动列表（用户自己的活动）
 */
async function getActivityList(openid, data) {
  // 处理参数结构，支持直接传入参数或通过data对象传入
  // 修复 "Cannot read properties of undefined (reading 'page')" 错误
  let page = 1;
  let limit = 20;
  let status = '';
  
  // 检查参数结构，兼容不同的调用方式
  if (data && typeof data === 'object') {
    page = data.page || 1;
    limit = data.limit || 20;
    status = data.status || '';
  }

  let whereCondition = {
    influencer_id: openid
  };

  if (status && status !== 'all') {
    whereCondition.status = status;
  }

  const result = await db.collection('activities')
    .where(whereCondition)
    .orderBy('created_at', 'desc')
    .skip((page - 1) * limit)
    .limit(limit)
    .get();

  const countResult = await db.collection('activities')
    .where(whereCondition)
    .count();

  // 获取每个活动的物品数量
  const activities = await Promise.all(
    result.data.map(async (activity) => {
      const itemsCount = await db.collection('items')
        .where({ activity_id: activity._id })
        .count();

      return {
        id: activity._id,
        title: activity.title || '',
        shareable_link: activity.shareable_link,
        status: activity.status,
        items_count: itemsCount.total,
        // 返回发货信息（用于自动填充）
        sender_address: activity.sender_address,
        sender_contact_name: activity.sender_contact_name,
        sender_contact_phone: activity.sender_contact_phone,
        created_at: activity.created_at
      };
    })
  );

  return {
    success: true,
    data: activities,
    pagination: {
      page,
      limit,
      total: countResult.total,
      total_pages: Math.ceil(countResult.total / limit)
    }
  };
}

/**
 * 获取公开活动列表
 */
async function getPublicActivityList(data) {
  try {
    // 处理参数结构，支持直接传入参数或通过data对象传入
    // 修复 "Cannot read properties of undefined (reading 'page')" 错误
    let page = 1;
    let limit = 20;
    let status = 'active';
    let category = '';
    
    // 检查参数结构，兼容不同的调用方式
    if (data && typeof data === 'object') {
      // 支持直接解构的情况
      page = data.page || 1;
      limit = data.limit || 20;
      status = data.status || 'active';
      category = data.category || '';
    }

    console.log('[Cloud Function] getPublicActivityList called with:', { page, limit, status, category });

    const result = await db.collection('activities')
      .where({
        status: status
      })
      .orderBy('created_at', 'desc')
      .skip((page - 1) * limit)
      .limit(limit)
      .get();

    console.log('[Cloud Function] Activities query result:', result);

    const countResult = await db.collection('activities')
      .where({ status: status })
      .count();

    console.log('[Cloud Function] Count result:', countResult);

    // 获取每个活动的物品和用户信息
    const activities = await Promise.all(
      (result.data || []).map(async (activity) => {
        // 获取物品
        const itemsResult = await db.collection('items')
          .where({ activity_id: activity._id })
          .get();

        // 获取用户信息
        const userResult = await db.collection('users')
          .where({ wechat_openid: activity.influencer_id })
          .get();

        const user = (userResult.data && userResult.data[0]) ? userResult.data[0] : {};

        // 转换图片 fileID 为临时链接
        const itemsWithTempUrls = await convertItemPhotoUrls(itemsResult.data || []);
        
        // 转换活动封面图
        const coverImageUrl = await convertSingleFileId(activity.cover_image_url);
        
        // 转换用户头像
        const avatarUrl = await convertSingleFileId(user.avatar_url);

        return {
          activity_id: activity._id,
          shareable_link: activity.shareable_link,
          cover_image_url: coverImageUrl,
          title: activity.title || '',
          description: activity.description || '',
          influencer: {
            nickname: user.nickname || '用户',
            avatar_url: avatarUrl
          },
          items: itemsWithTempUrls.map(item => ({
            item_id: item._id,
            photo_urls: item.photo_urls || [],
            category: item.category || 'other',
            label: item.label || '',
            shipping_cost_estimate: item.shipping_cost_estimate || 0,
            status: item.status || 'available'
          })),
          created_at: activity.created_at
        };
      })
    );

    // 确保 countResult 有 total 属性
    const total = (countResult && countResult.total !== undefined) ? countResult.total : 0;
    const currentPage = page || 1;
    const currentLimit = limit || 20;

    const pagination = {
      page: currentPage,
      limit: currentLimit,
      total: total,
      total_pages: total > 0 ? Math.ceil(total / currentLimit) : 0
    };

    const response = {
      success: true,
      data: {
        activities: activities || [],
        pagination: pagination
      }
    };

    console.log('[Cloud Function] Returning response:', JSON.stringify(response, null, 2));

    return response;
  } catch (error) {
    console.error('[Cloud Function] getPublicActivityList error:', error);
    console.error('[Cloud Function] Error stack:', error.stack);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to get public activity list'
      }
    };
  }
}

/**
 * 获取活动详情（需要登录）
 */
async function getActivityDetail(data) {
  const { activity_id } = data;

  console.log('[getActivityDetail] 查询活动详情:', { 
    activity_id, 
    type: typeof activity_id,
    length: activity_id ? activity_id.length : 0
  });

  try {
    const activityResult = await db.collection('activities')
      .doc(activity_id)
      .get();

    console.log('[getActivityDetail] 数据库查询结果:', {
      hasData: !!activityResult.data,
      errMsg: activityResult.errMsg
    });

    if (!activityResult.data) {
      return {
        success: false,
        error: {
          code: 'ACTIVITY_NOT_FOUND',
          message: `Activity not found with ID: ${activity_id}`
        }
      };
    }

    const activity = activityResult.data;

    // 获取物品
    const itemsResult = await db.collection('items')
      .where({ activity_id: activity_id })
      .get();

    console.log('[getActivityDetail] 物品查询结果:', {
      count: itemsResult.data.length
    });

    // 获取用户信息
    const userResult = await db.collection('users')
      .where({ wechat_openid: activity.influencer_id })
      .get();

    const user = userResult.data[0] || {};

    // 获取订单（如果是活动创建者）
    let orders = [];
    const ordersResult = await db.collection('orders')
      .where({ activity_id: activity_id })
      .get();
    orders = ordersResult.data;

    // 转换图片 fileID 为临时链接
    const itemsWithTempUrls = await convertItemPhotoUrls(itemsResult.data);
    
    // 转换活动封面图
    const coverImageUrl = await convertSingleFileId(activity.cover_image_url);
    
    // 转换用户头像
    const avatarUrl = await convertSingleFileId(user.avatar_url);

    const result = {
      success: true,
      data: {
        activity_id: activity._id,
        title: activity.title || '',
        description: activity.description || '',
        cover_image_url: coverImageUrl,
        shareable_link: activity.shareable_link,
        status: activity.status,
        total_items_count: activity.total_items_count || 0,
        available_items_count: activity.available_items_count || 0,
        influencer: {
          nickname: user.nickname || '用户',
          avatar_url: avatarUrl
        },
        items: itemsWithTempUrls.map(item => {
          const aiCategory = item.ai_category || item.category || 'other';
          return {
            item_id: item._id,
            photo_urls: item.photo_urls || [],
            category: aiCategory,  // 英文类别
            category_label: getCategoryLabel(aiCategory),  // 中文类别
            label: item.label || '',
            shipping_cost_estimate: item.shipping_cost_estimate || 0,
            base_shipping_cost: item.base_shipping_cost || calculateBaseShippingCost(aiCategory),
            status: item.remaining_quantity > 0 ? 'available' : 'claimed',
            marker_name: item.marker_name,
            marker_quantity: item.marker_quantity || 1,
            remaining_quantity: item.remaining_quantity !== undefined ? item.remaining_quantity : item.marker_quantity,
            marker_notes: item.marker_notes
          };
        }),
        orders: orders.map(order => ({
          id: order._id,
          item_id: order.item_id,
          order_status: order.order_status,
          payment_status: order.payment_status,
          total_amount: order.total_amount,
          created_at: order.created_at
        })),
        created_at: activity.created_at
      }
    };

    console.log('[getActivityDetail] 返回数据:', {
      activity_id: result.data.activity_id,
      title: result.data.title,
      items_count: result.data.items.length
    });

    return result;
  } catch (error) {
    console.error('[getActivityDetail] 查询出错:', error);
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: error.message || 'Failed to get activity detail'
      }
    };
  }
}

/**
 * 获取公开活动详情（不需要登录）
 */
async function getPublicActivityDetail(data) {
  const { link_id } = data;

  const activityResult = await db.collection('activities')
    .where({
      shareable_link: link_id,
      status: 'active'
    })
    .get();

  if (activityResult.data.length === 0) {
    return {
      success: false,
      error: {
        code: 'ACTIVITY_NOT_FOUND',
        message: 'Activity not found'
      }
    };
  }

  const activity = activityResult.data[0];

  // 获取物品
  const itemsResult = await db.collection('items')
    .where({ activity_id: activity._id })
    .get();

  // 获取用户信息
  const userResult = await db.collection('users')
    .where({ wechat_openid: activity.influencer_id })
    .get();

  const user = userResult.data[0] || {};

  // 转换图片 fileID 为临时链接
  const itemsWithTempUrls = await convertItemPhotoUrls(itemsResult.data);
  
  // 转换活动封面图
  const coverImageUrl = await convertSingleFileId(activity.cover_image_url);
  
  // 转换用户头像
  const avatarUrl = await convertSingleFileId(user.avatar_url);

  return {
    success: true,
    data: {
      activity_id: activity._id,
      title: activity.title || '',
      description: activity.description || '',
      cover_image_url: coverImageUrl,
      shareable_link: activity.shareable_link,
      status: activity.status,
      total_items_count: activity.total_items_count || 0,
      available_items_count: activity.available_items_count || 0,
      influencer_id: activity.influencer_id,
      is_password_protected: activity.is_password_protected || false,
      access_password: activity.access_password,  // 密码（用于验证）
      password_hint: activity.password_hint || '',  // 密码提示
      influencer: {
        nickname: user.nickname || '用户',
        avatar_url: avatarUrl
      },
      items: itemsWithTempUrls.map(item => {
        const aiCategory = item.ai_category || item.category || 'other';
        return {
          item_id: item._id,
          photo_urls: item.photo_urls || [],
          category: aiCategory,  // 英文类别
          category_label: getCategoryLabel(aiCategory),  // 中文类别
          label: item.label || '',
          shipping_cost_estimate: item.shipping_cost_estimate || 0,
          base_shipping_cost: item.base_shipping_cost || 10.0,
          status: item.remaining_quantity > 0 ? 'available' : 'claimed',
          marker_name: item.marker_name,
          marker_quantity: item.marker_quantity || 1,
          remaining_quantity: item.remaining_quantity !== undefined ? item.remaining_quantity : item.marker_quantity,
          marker_notes: item.marker_notes
        };
      }),
      created_at: activity.created_at
    }
  };
}

/**
 * 更新活动
 */
async function updateActivity(openid, data) {
  const { activity_id, ...updateData } = data;

  // 检查活动是否存在且属于当前用户
  const activityResult = await db.collection('activities')
    .doc(activity_id)
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

  // 更新活动
  await db.collection('activities')
    .doc(activity_id)
    .update({
      data: {
        ...updateData,
        updated_at: db.serverDate()
      }
    });

  return {
    success: true,
    data: {
      activity_id
    }
  };
}

/**
 * 取消活动
 */
async function cancelActivity(openid, data) {
  const { activity_id } = data;

  // 检查活动是否存在且属于当前用户
  const activityResult = await db.collection('activities')
    .doc(activity_id)
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

  // 更新活动状态
  await db.collection('activities')
    .doc(activity_id)
    .update({
      data: {
        status: 'cancelled',
        updated_at: db.serverDate()
      }
    });

  return {
    success: true,
    data: {
      activity_id
    }
  };
}

/**
 * 创建活动（含完整元数据）
 * 创建活动时自动升级用户为主播并更新身份证信息
 */
async function createWithMetadata(openid, data) {
  const {
    title,
    description,
    cover_image_url,
    source_platform,
    scheduled_start_time,
    is_immediate_publish,
    is_password_protected,
    access_password,
    password_hint,
    preferred_courier,
    sender_address,
    sender_contact_name,
    sender_contact_phone,
    // 身份证信息（个人认证小程序可选）
    id_card_number,
    id_card_name
  } = data;

  // 1. 验证身份证信息（仅当提供时验证格式）
  // 个人认证小程序不强制要求身份证
  if (id_card_number || id_card_name) {
    // 如果提侟了其中一个，则两个都必须提供
    if (!id_card_number || !id_card_name) {
      return {
        success: false,
        error: {
          code: 'INCOMPLETE_ID_CARD',
          message: '身份证号和姓名必须同时提供'
        }
      };
    }

    // 验证身份证号格式（15位或18位）
    const idCardPattern = /^(\d{15}|\d{17}[\dXx])$/;
    if (!idCardPattern.test(id_card_number)) {
      return {
        success: false,
        error: {
          code: 'INVALID_ID_CARD',
          message: '身份证号码格式不正确（应为15位或18位）'
        }
      };
    }

    // 验证姓名（2-10个中文字符或字母）
    const namePattern = /^[\u4e00-\u9fa5a-zA-Z]{2,10}$/;
    if (!namePattern.test(id_card_name)) {
      return {
        success: false,
        error: {
          code: 'INVALID_NAME',
          message: '姓名格式不正确（应为2-10个中文字符或字母）'
        }
      };
    }
  }

  // 2. 升级用户为主播并更新身份证信息（如果提供）
  try {
    // 先检查用户是否已经是主播
    const userResult = await db.collection('users')
      .where({ wechat_openid: openid })
      .get();

    if (userResult.data.length === 0) {
      return {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '用户不存在，请先注册'
        }
      };
    }

    const user = userResult.data[0];

    // 如果还不是主播，或者提供了新的身份证信息，则更新
    if (user.role !== 'influencer' || (id_card_number && !user.id_card_number)) {
      const updateData = {
        role: 'influencer',
        updated_at: db.serverDate()
      };
      
      // 如果提供了身份证信息，则更新
      if (id_card_number && id_card_name) {
        updateData.id_card_number = id_card_number;
        updateData.id_card_name = id_card_name;
      }
      
      await db.collection('users')
        .doc(user._id)
        .update({
          data: updateData
        });
      console.log('[createWithMetadata] 用户已升级为主播:', openid);
    }
  } catch (error) {
    console.error('[createWithMetadata] 升级主播失败:', error);
    return {
      success: false,
      error: {
        code: 'UPGRADE_FAILED',
        message: '升级主播失败: ' + error.message
      }
    };
  }

  // 3. 验证必填字段
  if (!title || title.length < 1 || title.length > 50) {
    return {
      success: false,
      error: {
        code: 'INVALID_TITLE',
        message: '活动标题必须为1-50个字符'
      }
    };
  }

  if (!source_platform || !['douyin', 'xiaohongshu', 'wechat', 'other'].includes(source_platform)) {
    return {
      success: false,
      error: {
        code: 'INVALID_PLATFORM',
        message: '请选择有效的来源平台'
      }
    };
  }

  if (!sender_address || !sender_contact_name || !sender_contact_phone) {
    return {
      success: false,
      error: {
        code: 'MISSING_SENDER_INFO',
        message: '发货人信息不完整'
      }
    };
  }

  // 验证联系电话（支持手机号和固定电话）
  const mobilePattern = /^1[3-9]\d{9}$/;  // 手机号：11位
  // 固定电话格式：
  // - 3位区号 + 8位号码：010-12345678
  // - 4位区号 + 7-8位号码：0755-8888888 或 0755-88888888
  const landlinePattern = /^0\d{2}-\d{8}$|^0\d{3}-\d{7,8}$/;
  
  if (!mobilePattern.test(sender_contact_phone) && !landlinePattern.test(sender_contact_phone)) {
    return {
      success: false,
      error: {
        code: 'INVALID_PHONE',
        message: '发货人联系电话格式不正确（支持手机号或固定电话，如：13800138000 或 010-12345678）'
      }
    };
  }

  // 验证密码
  if (is_password_protected) {
    if (!access_password || !/^[A-Za-z0-9]{4,8}$/.test(access_password)) {
      return {
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: '访问密码必须为4-8位字母或数字'
        }
      };
    }
  }

  // 4. 生成分享链接
  const shareable_link = generateShareableLink();
  const public_link_id = shareable_link; // 数据库中的索引字段

  try {
    // 创建活动
    const result = await db.collection('activities').add({
      data: {
        influencer_id: openid,
        title,
        description: description || '',
        cover_image_url: cover_image_url || null,
        source_platform,
        scheduled_start_time: scheduled_start_time || null,
        is_immediate_publish: is_immediate_publish !== false,
        is_password_protected: is_password_protected || false,
        access_password: is_password_protected ? access_password : null,
        password_hint: password_hint || null,
        preferred_courier: preferred_courier || null,
        sender_address: sender_address,  // 直接保存对象，不需要JSON.stringify
        sender_contact_name,
        sender_contact_phone,
        shareable_link,
        public_link_id,  // 添加数据库索引字段
        total_items_count: 0,
        available_items_count: 0,
        view_count: 0,
        access_attempts: 0,
        status: 'draft', // 初始为草稿状态
        created_at: db.serverDate(),
        updated_at: db.serverDate()
      }
    });

    return {
      success: true,
      data: {
        activity_id: result._id,
        shareable_link,
        status: 'draft'
      }
    };
  } catch (error) {
    console.error('创建活动失败:', error);
    
    // 处理重复键错误
    if (error.errCode === -502001 || error.message.includes('dup key')) {
      // 重新生成链接并重试
      const newLink = generateShareableLink();
      try {
        const retryResult = await db.collection('activities').add({
          data: {
            influencer_id: openid,
            title,
            description: description || '',
            cover_image_url: cover_image_url || null,
            source_platform,
            scheduled_start_time: scheduled_start_time || null,
            is_immediate_publish: is_immediate_publish !== false,
            is_password_protected: is_password_protected || false,
            access_password: is_password_protected ? access_password : null,
            password_hint: password_hint || null,
            preferred_courier: preferred_courier || null,
            sender_address: sender_address,
            sender_contact_name,
            sender_contact_phone,
            shareable_link: newLink,
            public_link_id: newLink,
            total_items_count: 0,
            available_items_count: 0,
            view_count: 0,
            access_attempts: 0,
            status: 'draft',
            created_at: db.serverDate(),
            updated_at: db.serverDate()
          }
        });

        return {
          success: true,
          data: {
            activity_id: retryResult._id,
            shareable_link: newLink,
            status: 'draft'
          }
        };
      } catch (retryError) {
        console.error('重试创建失败:', retryError);
        return {
          success: false,
          error: {
            code: 'CREATE_FAILED',
            message: '创建活动失败，请稍后重试'
          }
        };
      }
    }

    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: error.message || '数据库错误，请重试'
      }
    };
  }
}

/**
 * 发布活动
 */
async function publishActivity(openid, data) {
  const { activity_id } = data;

  // 检查活动是否存在且属于当前用户
  const activityResult = await db.collection('activities')
    .doc(activity_id)
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

  if (activityResult.data.influencer_id !== openid) {
    return {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: '无权限操作'
      }
    };
  }

  const activity = activityResult.data;

  // 检查是否有物品
  if (activity.total_items_count === 0) {
    return {
      success: false,
      error: {
        code: 'NO_ITEMS',
        message: '请先添加物品后再发布'
      }
    };
  }

  // 判断发布状态
  let newStatus = 'active';
  if (activity.scheduled_start_time && !activity.is_immediate_publish) {
    const scheduledTime = new Date(activity.scheduled_start_time);
    const now = new Date();
    if (scheduledTime > now) {
      newStatus = 'scheduled';
    }
  }

  // 更新活动状态
  await db.collection('activities')
    .doc(activity_id)
    .update({
      data: {
        status: newStatus,
        published_at: db.serverDate(),
        updated_at: db.serverDate()
      }
    });

  return {
    success: true,
    data: {
      activity_id,
      status: newStatus,
      shareable_link: activity.shareable_link
    }
  };
}

/**
 * 验证访问密码（增强版：5次错误限制）
 */
async function verifyPassword(data) {
  const { activity_id, password, user_openid } = data;

  const activity = await db.collection('activities')
    .doc(activity_id)
    .get();

  if (!activity.data) {
    return {
      success: false,
      error: {
        code: 'ACTIVITY_NOT_FOUND',
        message: '活动不存在'
      }
    };
  }

  if (!activity.data.is_password_protected) {
    return {
      success: true,
      data: { access_granted: true }
    };
  }

  // 检查该用户的错误次数（从password_errors集合）
  if (user_openid) {
    const errorRecords = await db.collection('password_errors')
      .where({
        activity_id: activity_id,
        user_openid: user_openid
      })
      .get();

    let errorCount = 0;
    let recordId = null;

    if (errorRecords.data.length > 0) {
      errorCount = errorRecords.data[0].error_count || 0;
      recordId = errorRecords.data[0]._id;

      // 如果已经达到5次错误，禁止访问
      if (errorCount >= 5) {
        return {
          success: false,
          error: {
            code: 'MAX_ATTEMPTS_REACHED',
            message: '密码错误次数过多，已被禁止访问',
            error_count: errorCount,
            max_attempts: 5
          }
        };
      }
    }

    // 验证密码
    if (activity.data.access_password === password) {
      // 密码正确，清除错误记录
      if (recordId) {
        await db.collection('password_errors')
          .doc(recordId)
          .remove();
      }

      return {
        success: true,
        data: { 
          access_granted: true,
          activity: activity.data
        }
      };
    }

    // 密码错误，记录错误次数
    if (recordId) {
      // 更新错误次数
      await db.collection('password_errors')
        .doc(recordId)
        .update({
          data: {
            error_count: _.inc(1),
            last_error_at: db.serverDate()
          }
        });
      errorCount++;
    } else {
      // 创建错误记录
      await db.collection('password_errors').add({
        data: {
          activity_id,
          user_openid,
          error_count: 1,
          last_error_at: db.serverDate(),
          created_at: db.serverDate()
        }
      });
      errorCount = 1;
    }

    return {
      success: false,
      error: {
        code: 'INCORRECT_PASSWORD',
        message: '密码错误',
        hint: activity.data.password_hint,
        error_count: errorCount,
        remaining_attempts: Math.max(0, 5 - errorCount)
      }
    };
  }

  // 兼容旧版本（没有user_openid的情况）
  // 记录尝试次数
  await db.collection('activities')
    .doc(activity_id)
    .update({
      data: {
        access_attempts: _.inc(1)
      }
    });

  if (activity.data.access_password === password) {
    return {
      success: true,
      data: { 
        access_granted: true,
        activity: activity.data
      }
    };
  }

  return {
    success: false,
    error: {
      code: 'INCORRECT_PASSWORD',
      message: '密码错误',
      hint: activity.data.password_hint
    }
  };
}

/**
 * 生成分享链接
 */
function generateShareableLink() {
  return `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 计算基础运费（根据物品分类）
 * @param {string} category - 物品分类
 * @returns {number} - 基础运费（元）
 */
function calculateBaseShippingCost(category) {
  // 根据分类设置不同的基础运费
  const baseCosts = {
    '服装': 10,
    '化妆品': 8,
    '日用品': 10,
    '食品': 12,
    '电子产品': 15,
    '玩具': 12,
    '文具': 8,
    '其他': 10
  };
  
  return baseCosts[category] || 10;
}

