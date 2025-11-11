// 分享帖子管理云函数
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
      case 'create':
        return await createSharingPost(OPENID, data);
      case 'update':  // 新增：更新晒单
        return await updateSharingPost(OPENID, data);
      case 'delete':  // 新增：删除恶意内容
        return await deleteSharingPost(OPENID, data);
      case 'getList':
        return await getSharingPostList(data);
      case 'getDetail':
        return await getSharingPostDetail(data);
      case 'getMyPosts':  // 新增：获取我的晒单
        return await getMyPosts(OPENID, data);
      case 'like':
        return await likeSharingPost(OPENID, data);
      case 'approve':  // 新增：审核通过
        return await approveSharingPost(OPENID, data);
      case 'reject':  // 新增：审核拒绝
        return await rejectSharingPost(OPENID, data);
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
    console.error('Sharing function error:', error);
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
 * 创建分享帖子（晒单）
 */
async function createSharingPost(openid, data) {
  const { order_id, photos, text_content } = data;

  console.log('[创建晒单] 开始:', { order_id, openid });

  // 验证订单是否存在且属于当前用户
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

  if (order.fan_wechat_openid !== openid) {
    return {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: '订单不属于您'
      }
    };
  }

  // 检查订单是否已签收（只有签收后才能晒单）
  if (order.order_status !== 'delivered') {
    return {
      success: false,
      error: {
        code: 'ORDER_NOT_DELIVERED',
        message: '订单尚未签收，请签收后再晒单',
        current_status: order.order_status
      }
    };
  }

  // 检查是否已有分享帖子
  const existingPost = await db.collection('sharing_posts')
    .where({
      order_id: order_id
    })
    .get();

  if (existingPost.data.length > 0) {
    return {
      success: false,
      error: {
        code: 'POST_ALREADY_EXISTS',
        message: '该订单已有晒单，请勿重复发布'
      }
    };
  }

  // 验证照片数量（1-9张）
  if (!photos || photos.length === 0) {
    return {
      success: false,
      error: {
        code: 'NO_PHOTOS',
        message: '请至少上传一张照片'
      }
    };
  }

  if (photos.length > 9) {
    return {
      success: false,
      error: {
        code: 'TOO_MANY_PHOTOS',
        message: '最多上传9张照片'
      }
    };
  }

  // 验证文本内容长度
  if (text_content && text_content.length > 500) {
    return {
      success: false,
      error: {
        code: 'INVALID_CONTENT',
        message: '文字内容超过500字'
      }
    };
  }

  // 获取用户信息
  const userResult = await db.collection('users')
    .where({ wechat_openid: openid })
    .get();

  const user = userResult.data[0] || {};

  // 创建分享帖子
  const result = await db.collection('sharing_posts').add({
    data: {
      order_id: order_id,
      activity_id: order.activity_id,
      fan_wechat_openid: openid,
      fan_nickname: user.nickname || '用户',
      fan_avatar: user.avatar_url || null,
      photos: photos,
      text_content: text_content || '',
      likes_count: 0,
      reward_points: 10, // 默认奖励10积分
      status: 'published', // 直接发布（也可设置为pending待审核）
      created_at: db.serverDate(),
      updated_at: db.serverDate()
    }
  });

  console.log('[创建晒单] 成功:', result._id);

  return {
    success: true,
    data: {
      post_id: result._id,
      message: '晒单发布成功'
    }
  };
}

/**
 * 获取分享帖子列表
 */
async function getSharingPostList(data) {
  const { page = 1, limit = 20, activity_id, status = 'published' } = data;

  let whereCondition = {
    status: status
  };

  if (activity_id) {
    whereCondition.activity_id = activity_id;
  }

  const result = await db.collection('sharing_posts')
    .where(whereCondition)
    .orderBy('created_at', 'desc')
    .skip((page - 1) * limit)
    .limit(limit)
    .get();

  const countResult = await db.collection('sharing_posts')
    .where(whereCondition)
    .count();

  // 获取用户信息
  const posts = await Promise.all(
    result.data.map(async (post) => {
      const userResult = await db.collection('users')
        .where({ wechat_openid: post.fan_wechat_openid })
        .get();

      const user = userResult.data[0] || {};

      return {
        id: post._id,
        order_id: post.order_id,
        activity_id: post.activity_id,
        fan: {
          nickname: user.nickname || '用户',
          avatar_url: user.avatar_url || null
        },
        photos: post.photos || [],
        text_content: post.text_content || '',
        likes_count: post.likes_count || 0,
        reward_points: post.reward_points || 0,
        created_at: post.created_at
      };
    })
  );

  return {
    success: true,
    data: {
      posts,
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
 * 获取分享帖子详情
 */
async function getSharingPostDetail(data) {
  const { post_id } = data;

  const postResult = await db.collection('sharing_posts')
    .doc(post_id)
    .get();

  if (!postResult.data) {
    return {
      success: false,
      error: {
        code: 'POST_NOT_FOUND',
        message: 'Sharing post not found'
      }
    };
  }

  const post = postResult.data;

  // 获取用户信息
  const userResult = await db.collection('users')
    .where({ wechat_openid: post.fan_wechat_openid })
    .get();

  const user = userResult.data[0] || {};

  // 获取订单信息
  const orderResult = await db.collection('orders')
    .doc(post.order_id)
    .get();

  return {
    success: true,
    data: {
      id: post._id,
      order_id: post.order_id,
      activity_id: post.activity_id,
      fan: {
        nickname: user.nickname || '用户',
        avatar_url: user.avatar_url || null
      },
      photos: post.photos || [],
      text_content: post.text_content || '',
      likes_count: post.likes_count || 0,
      reward_points: post.reward_points || 0,
      status: post.status,
      order: orderResult.data || null,
      created_at: post.created_at
    }
  };
}

/**
 * 点赞分享帖子
 */
async function likeSharingPost(openid, data) {
  const { post_id } = data;

  const postResult = await db.collection('sharing_posts')
    .doc(post_id)
    .get();

  if (!postResult.data) {
    return {
      success: false,
      error: {
        code: 'POST_NOT_FOUND',
        message: 'Sharing post not found'
      }
    };
  }

  // 增加点赞数
  await db.collection('sharing_posts')
    .doc(post_id)
    .update({
      data: {
        likes_count: _.inc(1),
        updated_at: db.serverDate()
      }
    });

  return {
    success: true,
    data: {
      post_id,
      likes_count: (postResult.data.likes_count || 0) + 1
    }
  };
}

/**
 * 更新晒单（仅限未发布或自己的）
 */
async function updateSharingPost(openid, data) {
  const { post_id, photos, text_content } = data;

  console.log('[更新晒单] 开始:', { post_id, openid });

  // 查询帖子
  const postResult = await db.collection('sharing_posts')
    .doc(post_id)
    .get();

  if (!postResult.data) {
    return {
      success: false,
      error: {
        code: 'POST_NOT_FOUND',
        message: '晒单不存在'
      }
    };
  }

  const post = postResult.data;

  // 检查权限
  if (post.fan_wechat_openid !== openid) {
    return {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: '无权更新此晒单'
      }
    };
  }

  // 验证照片数量
  if (photos && photos.length > 9) {
    return {
      success: false,
      error: {
        code: 'TOO_MANY_PHOTOS',
        message: '最多上传9张照片'
      }
    };
  }

  // 验证文本长度
  if (text_content && text_content.length > 500) {
    return {
      success: false,
      error: {
        code: 'INVALID_CONTENT',
        message: '文字内容超过500字'
      }
    };
  }

  // 更新数据
  const updateData = {
    updated_at: db.serverDate()
  };

  if (photos) {
    updateData.photos = photos;
  }

  if (text_content !== undefined) {
    updateData.text_content = text_content;
  }

  await db.collection('sharing_posts')
    .doc(post_id)
    .update({
      data: updateData
    });

  console.log('[更新晒单] 成功:', post_id);

  return {
    success: true,
    data: {
      post_id,
      message: '晒单更新成功'
    }
  };
}

/**
 * 删除恶意内容（主播权限）
 */
async function deleteSharingPost(openid, data) {
  const { post_id, reason = '违规内容' } = data;

  console.log('[删除晒单] 开始:', { post_id, openid, reason });

  // 查询帖子
  const postResult = await db.collection('sharing_posts')
    .doc(post_id)
    .get();

  if (!postResult.data) {
    return {
      success: false,
      error: {
        code: 'POST_NOT_FOUND',
        message: '晒单不存在'
      }
    };
  }

  const post = postResult.data;

  // 检查权限：本人或活动主播
  let hasPermission = false;

  if (post.fan_wechat_openid === openid) {
    // 本人可以删除自己的晒单
    hasPermission = true;
  } else {
    // 检查是否是活动主播
    const activityResult = await db.collection('activities')
      .doc(post.activity_id)
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
        message: '无权删除此晒单'
      }
    };
  }

  // 删除帖子（软删除，标记为deleted）
  await db.collection('sharing_posts')
    .doc(post_id)
    .update({
      data: {
        status: 'deleted',
        delete_reason: reason,
        deleted_by: openid,
        deleted_at: db.serverDate(),
        updated_at: db.serverDate()
      }
    });

  console.log('[删除晒单] 成功:', post_id);

  return {
    success: true,
    data: {
      post_id,
      message: '晒单已删除'
    }
  };
}

/**
 * 获取我的晒单列表
 */
async function getMyPosts(openid, data) {
  const { page = 1, limit = 20, status } = data;

  let whereCondition = {
    fan_wechat_openid: openid,
    status: _.neq('deleted')  // 不包含已删除的
  };

  if (status) {
    whereCondition.status = status;
  }

  const result = await db.collection('sharing_posts')
    .where(whereCondition)
    .orderBy('created_at', 'desc')
    .skip((page - 1) * limit)
    .limit(limit)
    .get();

  const countResult = await db.collection('sharing_posts')
    .where(whereCondition)
    .count();

  // 获取订单信息
  const posts = await Promise.all(
    result.data.map(async (post) => {
      const orderResult = await db.collection('orders')
        .doc(post.order_id)
        .get();

      return {
        id: post._id,
        order_id: post.order_id,
        activity_id: post.activity_id,
        photos: post.photos || [],
        text_content: post.text_content || '',
        likes_count: post.likes_count || 0,
        reward_points: post.reward_points || 0,
        status: post.status,
        order: orderResult.data || null,
        created_at: post.created_at
      };
    })
  );

  return {
    success: true,
    data: {
      posts,
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
 * 审核通过（主播权限）
 */
async function approveSharingPost(openid, data) {
  const { post_id } = data;

  console.log('[审核通过] 开始:', { post_id, openid });

  // 查询帖子
  const postResult = await db.collection('sharing_posts')
    .doc(post_id)
    .get();

  if (!postResult.data) {
    return {
      success: false,
      error: {
        code: 'POST_NOT_FOUND',
        message: '晒单不存在'
      }
    };
  }

  const post = postResult.data;

  // 检查权限（只有活动主播可以审核）
  const activityResult = await db.collection('activities')
    .doc(post.activity_id)
    .get();

  if (!activityResult.data || activityResult.data.influencer_id !== openid) {
    return {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: '无权审核此晒单'
      }
    };
  }

  // 更新状态为已发布
  await db.collection('sharing_posts')
    .doc(post_id)
    .update({
      data: {
        status: 'published',
        approved_by: openid,
        approved_at: db.serverDate(),
        updated_at: db.serverDate()
      }
    });

  console.log('[审核通过] 成功:', post_id);

  return {
    success: true,
    data: {
      post_id,
      message: '审核通过'
    }
  };
}

/**
 * 审核拒绝（主播权限）
 */
async function rejectSharingPost(openid, data) {
  const { post_id, reason = '内容不符合要求' } = data;

  console.log('[审核拒绝] 开始:', { post_id, openid, reason });

  // 查询帖子
  const postResult = await db.collection('sharing_posts')
    .doc(post_id)
    .get();

  if (!postResult.data) {
    return {
      success: false,
      error: {
        code: 'POST_NOT_FOUND',
        message: '晒单不存在'
      }
    };
  }

  const post = postResult.data;

  // 检查权限
  const activityResult = await db.collection('activities')
    .doc(post.activity_id)
    .get();

  if (!activityResult.data || activityResult.data.influencer_id !== openid) {
    return {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: '无权审核此晒单'
      }
    };
  }

  // 更新状态为拒绝
  await db.collection('sharing_posts')
    .doc(post_id)
    .update({
      data: {
        status: 'rejected',
        reject_reason: reason,
        rejected_by: openid,
        rejected_at: db.serverDate(),
        updated_at: db.serverDate()
      }
    });

  console.log('[审核拒绝] 成功:', post_id);

  return {
    success: true,
    data: {
      post_id,
      message: '审核拒绝'
    }
  };
}
