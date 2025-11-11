// 数据统计云函数
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
      case 'getUserStats':  // 获取用户统计数据
        return await getUserStats(OPENID, data);
      case 'getActivityStats':  // 获取活动统计数据
        return await getActivityStats(OPENID, data);
      case 'getOverallStats':  // 获取整体统计数据（主播）
        return await getOverallStats(OPENID);
      case 'getPlatformStats':  // 获取平台统计数据（管理员）
        return await getPlatformStats();
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
    console.error('Analytics function error:', error);
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
 * 获取用户统计数据
 * 包含：领取次数、支付金额、晒单数、点赞数等
 */
async function getUserStats(openid, data) {
  console.log('[用户统计] 开始:', openid);

  try {
    // 获取用户信息
    const userResult = await db.collection('users')
      .where({ wechat_openid: openid })
      .get();

    if (userResult.data.length === 0) {
      return {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '用户不存在'
        }
      };
    }

    const user = userResult.data[0];

    // 统计订单数据
    const ordersResult = await db.collection('orders')
      .where({ fan_wechat_openid: openid })
      .get();

    const totalOrders = ordersResult.data.length;
    const paidOrders = ordersResult.data.filter(o => o.payment_status === 'paid').length;
    const deliveredOrders = ordersResult.data.filter(o => o.order_status === 'delivered').length;
    const totalSpent = ordersResult.data
      .filter(o => o.payment_status === 'paid')
      .reduce((sum, o) => sum + (o.total_amount || 0), 0);

    // 统计晒单数据
    const sharingResult = await db.collection('sharing_posts')
      .where({
        fan_wechat_openid: openid,
        status: _.neq('deleted')
      })
      .get();

    const totalPosts = sharingResult.data.length;
    const totalLikes = sharingResult.data.reduce((sum, p) => sum + (p.likes_count || 0), 0);

    // 统计活动数据（如果是主播）
    let createdActivities = 0;
    let totalItemsGiven = 0;

    if (user.role === 'influencer') {
      const activitiesResult = await db.collection('activities')
        .where({ influencer_id: openid })
        .get();

      createdActivities = activitiesResult.data.length;

      // 统计赠送的物品总数
      for (const activity of activitiesResult.data) {
        const itemsResult = await db.collection('items')
          .where({ activity_id: activity._id })
          .get();

        totalItemsGiven += itemsResult.data.reduce((sum, item) => {
          const total = item.marker_quantity || 1;
          const remaining = item.remaining_quantity !== undefined ? item.remaining_quantity : total;
          return sum + (total - remaining);
        }, 0);
      }
    }

    return {
      success: true,
      data: {
        user: {
          role: user.role,
          nickname: user.nickname || '用户',
          avatar_url: user.avatar_url
        },
        fan_stats: {
          total_orders: totalOrders,
          paid_orders: paidOrders,
          delivered_orders: deliveredOrders,
          total_spent: totalSpent.toFixed(2),
          total_posts: totalPosts,
          total_likes: totalLikes
        },
        influencer_stats: user.role === 'influencer' ? {
          created_activities: createdActivities,
          total_items_given: totalItemsGiven
        } : null
      }
    };
  } catch (error) {
    console.error('[用户统计] 错误:', error);
    return {
      success: false,
      error: {
        code: 'STATS_FAILED',
        message: error.message || '统计数据失败'
      }
    };
  }
}

/**
 * 获取活动统计数据
 * 包含：总物品数、已领取数、待发货数、已签收数等
 */
async function getActivityStats(openid, data) {
  const { activity_id } = data;

  console.log('[活动统计] 开始:', { activity_id, openid });

  try {
    // 查询活动
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

    const activity = activityResult.data;

    // 检查权限（只有活动创建者可以查看详细统计）
    if (activity.influencer_id !== openid) {
      return {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: '无权查看此活动统计'
        }
      };
    }

    // 统计物品数据
    const itemsResult = await db.collection('items')
      .where({ activity_id: activity_id })
      .get();

    const totalItems = itemsResult.data.reduce((sum, item) => sum + (item.marker_quantity || 1), 0);
    const claimedItems = itemsResult.data.reduce((sum, item) => {
      const total = item.marker_quantity || 1;
      const remaining = item.remaining_quantity !== undefined ? item.remaining_quantity : total;
      return sum + (total - remaining);
    }, 0);
    const remainingItems = totalItems - claimedItems;

    // 统计订单数据
    const ordersResult = await db.collection('orders')
      .where({ activity_id: activity_id })
      .get();

    const totalOrders = ordersResult.data.length;
    const pendingOrders = ordersResult.data.filter(o => o.order_status === 'pending').length;
    const shippedOrders = ordersResult.data.filter(o => o.order_status === 'shipped').length;
    const deliveredOrders = ordersResult.data.filter(o => o.order_status === 'delivered').length;
    const cancelledOrders = ordersResult.data.filter(o => o.order_status === 'cancelled').length;

    // 统计收入数据
    const totalRevenue = ordersResult.data
      .filter(o => o.payment_status === 'paid')
      .reduce((sum, o) => sum + (o.total_amount || 0), 0);

    const totalShippingCost = ordersResult.data
      .filter(o => o.payment_status === 'paid')
      .reduce((sum, o) => sum + (o.shipping_cost || 0), 0);

    const totalPackagingFee = ordersResult.data
      .filter(o => o.payment_status === 'paid')
      .reduce((sum, o) => sum + (o.packaging_fee || 0), 0);

    const totalPlatformFee = ordersResult.data
      .filter(o => o.payment_status === 'paid')
      .reduce((sum, o) => sum + (o.platform_fee || 0), 0);

    // 统计晒单数据
    const sharingResult = await db.collection('sharing_posts')
      .where({
        activity_id: activity_id,
        status: _.neq('deleted')
      })
      .get();

    const totalPosts = sharingResult.data.length;
    const totalLikes = sharingResult.data.reduce((sum, p) => sum + (p.likes_count || 0), 0);

    // 统计独立粉丝数
    const uniqueFans = new Set(ordersResult.data.map(o => o.fan_wechat_openid)).size;

    return {
      success: true,
      data: {
        activity: {
          title: activity.title,
          status: activity.status,
          created_at: activity.created_at
        },
        items_stats: {
          total_items: totalItems,
          claimed_items: claimedItems,
          remaining_items: remainingItems,
          claim_rate: totalItems > 0 ? ((claimedItems / totalItems) * 100).toFixed(2) + '%' : '0%'
        },
        order_stats: {
          total_orders: totalOrders,
          pending_orders: pendingOrders,
          shipped_orders: shippedOrders,
          delivered_orders: deliveredOrders,
          cancelled_orders: cancelledOrders,
          delivery_rate: totalOrders > 0 ? ((deliveredOrders / totalOrders) * 100).toFixed(2) + '%' : '0%'
        },
        revenue_stats: {
          total_revenue: totalRevenue.toFixed(2),
          total_shipping_cost: totalShippingCost.toFixed(2),
          total_packaging_fee: totalPackagingFee.toFixed(2),
          total_platform_fee: totalPlatformFee.toFixed(2)
        },
        engagement_stats: {
          unique_fans: uniqueFans,
          total_posts: totalPosts,
          total_likes: totalLikes,
          post_rate: deliveredOrders > 0 ? ((totalPosts / deliveredOrders) * 100).toFixed(2) + '%' : '0%'
        }
      }
    };
  } catch (error) {
    console.error('[活动统计] 错误:', error);
    return {
      success: false,
      error: {
        code: 'STATS_FAILED',
        message: error.message || '统计数据失败'
      }
    };
  }
}

/**
 * 获取整体统计数据（主播）
 * 包含：总活动数、总赠送量、总粉丝数等
 */
async function getOverallStats(openid) {
  console.log('[整体统计] 开始:', openid);

  try {
    // 获取用户信息
    const userResult = await db.collection('users')
      .where({ wechat_openid: openid })
      .get();

    if (userResult.data.length === 0 || userResult.data[0].role !== 'influencer') {
      return {
        success: false,
        error: {
          code: 'NOT_INFLUENCER',
          message: '仅限主播查看整体统计'
        }
      };
    }

    // 统计活动数据
    const activitiesResult = await db.collection('activities')
      .where({ influencer_id: openid })
      .get();

    const totalActivities = activitiesResult.data.length;
    const activeActivities = activitiesResult.data.filter(a => a.status === 'active').length;

    // 统计所有活动的物品数据
    let totalItemsCreated = 0;
    let totalItemsGiven = 0;

    for (const activity of activitiesResult.data) {
      const itemsResult = await db.collection('items')
        .where({ activity_id: activity._id })
        .get();

      const activityTotal = itemsResult.data.reduce((sum, item) => sum + (item.marker_quantity || 1), 0);
      totalItemsCreated += activityTotal;

      const activityGiven = itemsResult.data.reduce((sum, item) => {
        const total = item.marker_quantity || 1;
        const remaining = item.remaining_quantity !== undefined ? item.remaining_quantity : total;
        return sum + (total - remaining);
      }, 0);
      totalItemsGiven += activityGiven;
    }

    // 统计订单数据
    const ordersResult = await db.collection('orders')
      .where({
        activity_id: _.in(activitiesResult.data.map(a => a._id))
      })
      .get();

    const totalOrders = ordersResult.data.length;
    const deliveredOrders = ordersResult.data.filter(o => o.order_status === 'delivered').length;

    // 统计独立粉丝数
    const uniqueFans = new Set(ordersResult.data.map(o => o.fan_wechat_openid)).size;

    // 统计晒单数据
    const sharingResult = await db.collection('sharing_posts')
      .where({
        activity_id: _.in(activitiesResult.data.map(a => a._id)),
        status: _.neq('deleted')
      })
      .get();

    const totalPosts = sharingResult.data.length;
    const totalLikes = sharingResult.data.reduce((sum, p) => sum + (p.likes_count || 0), 0);

    // 统计收入数据
    const totalRevenue = ordersResult.data
      .filter(o => o.payment_status === 'paid')
      .reduce((sum, o) => sum + (o.total_amount || 0), 0);

    return {
      success: true,
      data: {
        activity_stats: {
          total_activities: totalActivities,
          active_activities: activeActivities
        },
        item_stats: {
          total_items_created: totalItemsCreated,
          total_items_given: totalItemsGiven,
          remaining_items: totalItemsCreated - totalItemsGiven,
          give_away_rate: totalItemsCreated > 0 ? ((totalItemsGiven / totalItemsCreated) * 100).toFixed(2) + '%' : '0%'
        },
        fan_stats: {
          unique_fans: uniqueFans,
          total_orders: totalOrders,
          delivered_orders: deliveredOrders
        },
        engagement_stats: {
          total_posts: totalPosts,
          total_likes: totalLikes,
          avg_likes_per_post: totalPosts > 0 ? (totalLikes / totalPosts).toFixed(2) : '0'
        },
        revenue_stats: {
          total_revenue: totalRevenue.toFixed(2)
        }
      }
    };
  } catch (error) {
    console.error('[整体统计] 错误:', error);
    return {
      success: false,
      error: {
        code: 'STATS_FAILED',
        message: error.message || '统计数据失败'
      }
    };
  }
}

/**
 * 获取平台统计数据（管理员）
 * 包含：总用户数、总活动数、总订单数等
 */
async function getPlatformStats() {
  console.log('[平台统计] 开始');

  try {
    // 统计用户数据
    const usersCount = await db.collection('users').count();
    const influencersCount = await db.collection('users')
      .where({ role: 'influencer' })
      .count();

    // 统计活动数据
    const activitiesCount = await db.collection('activities').count();
    const activeActivitiesCount = await db.collection('activities')
      .where({ status: 'active' })
      .count();

    // 统计物品数据
    const itemsCount = await db.collection('items').count();

    // 统计订单数据
    const ordersCount = await db.collection('orders').count();
    const paidOrdersCount = await db.collection('orders')
      .where({ payment_status: 'paid' })
      .count();

    // 统计晒单数据
    const postsCount = await db.collection('sharing_posts')
      .where({ status: _.neq('deleted') })
      .count();

    return {
      success: true,
      data: {
        user_stats: {
          total_users: usersCount.total,
          total_influencers: influencersCount.total,
          total_fans: usersCount.total - influencersCount.total
        },
        activity_stats: {
          total_activities: activitiesCount.total,
          active_activities: activeActivitiesCount.total
        },
        item_stats: {
          total_items: itemsCount.total
        },
        order_stats: {
          total_orders: ordersCount.total,
          paid_orders: paidOrdersCount.total
        },
        engagement_stats: {
          total_posts: postsCount.total
        }
      }
    };
  } catch (error) {
    console.error('[平台统计] 错误:', error);
    return {
      success: false,
      error: {
        code: 'STATS_FAILED',
        message: error.message || '统计数据失败'
      }
    };
  }
}
