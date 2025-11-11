// 测试数据生成云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 云函数入口函数
 * @param {Object} event - 事件对象
 * @param {Object} context - 上下文对象
 */
exports.main = async (event, context) => {
  const { action, data } = event;
  
  try {
    switch (action) {
      case 'createTestUser':
        return await createTestUser(data);
      case 'createMultipleTestUsers':
        return await createMultipleTestUsers(data);
      case 'clearTestUsers':
        return await clearTestUsers();
      default:
        return {
          success: false,
          error: {
            code: 'UNKNOWN_ACTION',
            message: `Unknown action: ${action || 'undefined'}`
          }
        };
    }
  } catch (error) {
    console.error('Test data function error:', error);
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
 * 创建单个测试用户
 * @param {Object} userData - 用户数据
 */
async function createTestUser(userData = {}) {
  try {
    // 默认测试用户数据
    const defaultUserData = {
      wechat_openid: `test_openid_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      phone_number: `1380000${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      nickname: userData.nickname || `测试用户${Math.floor(Math.random() * 1000)}`,
      avatar_url: userData.avatar_url || '',
      shipping_address: JSON.stringify({
        province: '北京市',
        city: '北京市',
        district: '朝阳区',
        detail: '测试街道123号'
      }),
      shipping_contact_name: userData.shipping_contact_name || '测试联系人',
      shipping_contact_phone: `1380000${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      account_status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    };
    
    // 合并用户提供的数据
    const finalUserData = { ...defaultUserData, ...userData };
    
    // 检查是否已存在相同openid的用户
    const existing = await db.collection('users')
      .where({
        wechat_openid: finalUserData.wechat_openid
      })
      .get();
      
    if (existing.data.length > 0) {
      // 更新现有用户
      const result = await db.collection('users')
        .where({ wechat_openid: finalUserData.wechat_openid })
        .update({
          data: finalUserData
        });
        
      return {
        success: true,
        data: {
          user_id: existing.data[0]._id,
          message: '测试用户已更新',
          user: { ...finalUserData, _id: existing.data[0]._id }
        }
      };
    } else {
      // 创建新用户
      const result = await db.collection('users').add({
        data: finalUserData
      });
      
      return {
        success: true,
        data: {
          user_id: result._id,
          message: '测试用户创建成功',
          user: { ...finalUserData, _id: result._id }
        }
      };
    }
  } catch (error) {
    console.error('Create test user error:', error);
    return {
      success: false,
      error: {
        code: 'CREATE_USER_FAILED',
        message: error.message || '创建测试用户失败'
      }
    };
  }
}

/**
 * 创建多个测试用户
 * @param {Object} options - 创建选项
 */
async function createMultipleTestUsers(options = {}) {
  const { count = 5, prefix = '测试用户' } = options;
  const results = [];
  
  try {
    for (let i = 1; i <= count; i++) {
      const userData = {
        nickname: `${prefix}${i}`,
        phone_number: `1380000${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
      };
      
      const result = await createTestUser(userData);
      results.push(result);
    }
    
    return {
      success: true,
      data: {
        message: `成功创建${count}个测试用户`,
        results
      }
    };
  } catch (error) {
    console.error('Create multiple test users error:', error);
    return {
      success: false,
      error: {
        code: 'CREATE_MULTIPLE_USERS_FAILED',
        message: error.message || '创建多个测试用户失败'
      }
    };
  }
}

/**
 * 清除所有测试用户
 */
async function clearTestUsers() {
  try {
    // 注意：在生产环境中不要使用此功能
    // 这里我们只删除测试用户（以test_openid_开头的）
    const result = await db.collection('users')
      .where({
        wechat_openid: db.RegExp({
          regexp: '^test_openid_',
          options: 'i'
        })
      })
      .remove();
      
    return {
      success: true,
      data: {
        message: `成功清除${result.stats.removed}个测试用户`,
        removedCount: result.stats.removed
      }
    };
  } catch (error) {
    console.error('Clear test users error:', error);
    return {
      success: false,
      error: {
        code: 'CLEAR_USERS_FAILED',
        message: error.message || '清除测试用户失败'
      }
    };
  }
}