// 数据库索引创建助手云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

/**
 * 索引创建助手
 * 生成详细的索引创建指南和验证脚本
 */
exports.main = async (event, context) => {
  const { action } = event;
  
  if (action === 'verify') {
    // 验证已创建的索引
    return await verifyIndexes();
  }
  
  // 默认返回索引创建指南
  return getIndexCreationGuide();
};

/**
 * 获取索引创建指南
 */
function getIndexCreationGuide() {
  const guide = {
    title: '📋 云数据库索引创建指南',
    note: '⚠️ 微信云开发不支持通过代码自动创建索引，请按照以下步骤在控制台手动创建',
    
    steps: [
      '1. 打开微信开发者工具或浏览器访问云开发控制台',
      '2. 进入「云开发」→「数据库」',
      '3. 选择对应的集合',
      '4. 点击「索引」标签',
      '5. 点击「添加索引」按钮',
      '6. 按照下方配置填写索引信息',
      '7. 点击「确定」创建索引'
    ],
    
    collections: {
      users: {
        description: '用户集合 - 3个索引',
        indexes: [
          {
            indexName: 'openid_index',
            fields: [{ fieldName: 'openid', order: 'asc' }],
            unique: true,
            description: '✅ 唯一索引 - 用户openid，用于快速查找用户'
          },
          {
            indexName: 'phone_index',
            fields: [{ fieldName: 'phone_number', order: 'asc' }],
            unique: false,
            description: '手机号索引'
          },
          {
            indexName: 'role_index',
            fields: [{ fieldName: 'role', order: 'asc' }],
            unique: false,
            description: '角色索引（influencer/fan）'
          }
        ]
      },
      
      activities: {
        description: '赠送活动集合 - 4个索引',
        indexes: [
          {
            indexName: 'influencer_id_index',
            fields: [{ fieldName: 'influencer_id', order: 'asc' }],
            unique: false,
            description: '主播ID索引，用于查询主播的所有活动'
          },
          {
            indexName: 'status_index',
            fields: [{ fieldName: 'status', order: 'asc' }],
            unique: false,
            description: '活动状态索引（active/completed/cancelled）'
          },
          {
            indexName: 'influencer_status_compound',
            fields: [
              { fieldName: 'influencer_id', order: 'asc' },
              { fieldName: 'status', order: 'asc' }
            ],
            unique: false,
            description: '🔥 复合索引 - 主播ID+状态，查询效率更高'
          },
          {
            indexName: 'created_at_index',
            fields: [{ fieldName: 'created_at', order: 'desc' }],
            unique: false,
            description: '创建时间索引，用于排序（降序）'
          }
        ]
      },
      
      items: {
        description: '物品集合 - 4个索引',
        indexes: [
          {
            indexName: 'activity_id_index',
            fields: [{ fieldName: 'activity_id', order: 'asc' }],
            unique: false,
            description: '活动ID索引，用于查询活动的所有物品'
          },
          {
            indexName: 'status_index',
            fields: [{ fieldName: 'status', order: 'asc' }],
            unique: false,
            description: '物品状态索引（available/claimed/shipped）'
          },
          {
            indexName: 'activity_status_compound',
            fields: [
              { fieldName: 'activity_id', order: 'asc' },
              { fieldName: 'status', order: 'asc' }
            ],
            unique: false,
            description: '🔥 复合索引 - 活动ID+状态'
          },
          {
            indexName: 'item_number_index',
            fields: [{ fieldName: 'item_number', order: 'asc' }],
            unique: false,
            description: '5位数字编号索引'
          }
        ]
      },
      
      orders: {
        description: '订单集合 - 6个索引',
        indexes: [
          {
            indexName: 'activity_id_index',
            fields: [{ fieldName: 'activity_id', order: 'asc' }],
            unique: false,
            description: '活动ID索引'
          },
          {
            indexName: 'fan_wechat_openid_index',
            fields: [{ fieldName: 'fan_wechat_openid', order: 'asc' }],
            unique: false,
            description: '粉丝openid索引，用于查询用户订单'
          },
          {
            indexName: 'payment_status_index',
            fields: [{ fieldName: 'payment_status', order: 'asc' }],
            unique: false,
            description: '支付状态索引（pending/paid/failed/refunded）'
          },
          {
            indexName: 'order_status_index',
            fields: [{ fieldName: 'order_status', order: 'asc' }],
            unique: false,
            description: '订单状态索引（pending/processing/shipped/completed）'
          },
          {
            indexName: 'payment_deadline_index',
            fields: [{ fieldName: 'payment_deadline', order: 'asc' }],
            unique: false,
            description: '⚠️ 重要 - 支付截止时间索引，用于超时检查'
          },
          {
            indexName: 'created_at_index',
            fields: [{ fieldName: 'created_at', order: 'desc' }],
            unique: false,
            description: '创建时间索引（降序）'
          }
        ]
      },
      
      payments: {
        description: '支付记录集合 - 4个索引',
        indexes: [
          {
            indexName: 'order_id_index',
            fields: [{ fieldName: 'order_id', order: 'asc' }],
            unique: false,
            description: '订单ID索引'
          },
          {
            indexName: 'transaction_id_index',
            fields: [{ fieldName: 'transaction_id', order: 'asc' }],
            unique: true,
            description: '✅ 唯一索引 - 微信交易号'
          },
          {
            indexName: 'fan_openid_index',
            fields: [{ fieldName: 'fan_openid', order: 'asc' }],
            unique: false,
            description: '粉丝openid索引'
          },
          {
            indexName: 'status_index',
            fields: [{ fieldName: 'status', order: 'asc' }],
            unique: false,
            description: '支付状态索引'
          }
        ]
      },
      
      shipping_info: {
        description: '物流信息集合 - 4个索引',
        indexes: [
          {
            indexName: 'order_id_index',
            fields: [{ fieldName: 'order_id', order: 'asc' }],
            unique: true,
            description: '✅ 唯一索引 - 订单ID，一个订单对应一条物流信息'
          },
          {
            indexName: 'tracking_number_index',
            fields: [{ fieldName: 'tracking_number', order: 'asc' }],
            unique: false,
            description: '运单号索引'
          },
          {
            indexName: 'courier_company_index',
            fields: [{ fieldName: 'courier_company', order: 'asc' }],
            unique: false,
            description: '快递公司索引'
          },
          {
            indexName: 'logistics_status_index',
            fields: [{ fieldName: 'logistics_status', order: 'asc' }],
            unique: false,
            description: '物流状态索引'
          }
        ]
      },
      
      password_errors: {
        description: '密码错误记录集合 - 2个索引',
        indexes: [
          {
            indexName: 'activity_user_compound',
            fields: [
              { fieldName: 'activity_id', order: 'asc' },
              { fieldName: 'user_openid', order: 'asc' }
            ],
            unique: false,
            description: '🔥 复合索引 - 活动ID+用户openid，用于快速查询错误次数'
          },
          {
            indexName: 'created_at_index',
            fields: [{ fieldName: 'created_at', order: 'asc' }],
            unique: false,
            description: '创建时间索引，用于清理过期记录'
          }
        ]
      },
      
      sharing_posts: {
        description: '晒单集合 - 4个索引',
        indexes: [
          {
            indexName: 'order_id_index',
            fields: [{ fieldName: 'order_id', order: 'asc' }],
            unique: false,
            description: '订单ID索引'
          },
          {
            indexName: 'activity_id_index',
            fields: [{ fieldName: 'activity_id', order: 'asc' }],
            unique: false,
            description: '活动ID索引'
          },
          {
            indexName: 'user_openid_index',
            fields: [{ fieldName: 'user_openid', order: 'asc' }],
            unique: false,
            description: '用户openid索引'
          },
          {
            indexName: 'created_at_index',
            fields: [{ fieldName: 'created_at', order: 'desc' }],
            unique: false,
            description: '创建时间索引，用于按时间排序（降序）'
          }
        ]
      },
      
      external_activities: {
        description: '外部活动集合 - 2个索引',
        indexes: [
          {
            indexName: 'influencer_id_index',
            fields: [{ fieldName: 'influencer_id', order: 'asc' }],
            unique: false,
            description: '主播ID索引'
          },
          {
            indexName: 'activity_time_index',
            fields: [{ fieldName: 'activity_time', order: 'desc' }],
            unique: false,
            description: '活动时间索引（降序）'
          }
        ]
      }
    },
    
    summary: {
      totalCollections: 9,
      totalIndexes: 33,
      uniqueIndexes: 3,
      compoundIndexes: 3,
      tips: [
        '💡 优先创建带 ✅ 标记的唯一索引',
        '💡 复合索引（带 🔥 标记）能显著提升查询性能',
        '💡 时间索引建议使用降序（desc），便于获取最新数据',
        '💡 索引创建后立即生效，无需重启服务',
        '💡 可通过调用 db-index-helper 云函数并传入 {action: "verify"} 验证索引是否创建成功'
      ]
    }
  };
  
  return {
    success: true,
    data: guide
  };
}

/**
 * 验证索引是否已创建
 * 注意：云开发暂不支持通过API查询索引，此功能待后续支持
 */
async function verifyIndexes() {
  return {
    success: false,
    message: '索引验证功能暂不可用',
    note: '云开发数据库目前不支持通过API查询索引信息，请在云开发控制台手动检查索引是否创建成功'
  };
}
