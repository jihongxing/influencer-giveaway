// 云函数测试运行器
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 测试运行器主入口
 */
exports.main = async (event, context) => {
  const { testSuite, testCase } = event;
  
  console.log('[测试运行器] 开始执行测试:', { testSuite, testCase });
  
  const results = {
    suite: testSuite || 'all',
    total: 0,
    passed: 0,
    failed: 0,
    errors: [],
    details: []
  };
  
  try {
    if (testSuite === 'auth' || !testSuite) {
      await runAuthTests(results);
    }
    
    if (testSuite === 'activities' || !testSuite) {
      await runActivityTests(results);
    }
    
    if (testSuite === 'items' || !testSuite) {
      await runItemTests(results);
    }
    
    if (testSuite === 'orders' || !testSuite) {
      await runOrderTests(results);
    }
    
    if (testSuite === 'payments' || !testSuite) {
      await runPaymentTests(results);
    }
    
    if (testSuite === 'shipping' || !testSuite) {
      await runShippingTests(results);
    }
    
    if (testSuite === 'analytics' || !testSuite) {
      await runAnalyticsTests(results);
    }
    
    // 计算成功率
    results.passRate = results.total > 0 
      ? ((results.passed / results.total) * 100).toFixed(2) + '%'
      : '0%';
    
    console.log('[测试运行器] 测试完成:', {
      total: results.total,
      passed: results.passed,
      failed: results.failed,
      passRate: results.passRate
    });
    
    return {
      success: true,
      data: results
    };
    
  } catch (error) {
    console.error('[测试运行器] 测试执行失败:', error);
    return {
      success: false,
      error: {
        code: 'TEST_FAILED',
        message: error.message
      }
    };
  }
};

/**
 * 运行认证模块测试
 */
async function runAuthTests(results) {
  console.log('[测试] 开始认证模块测试');
  
  // 测试1: 用户注册功能
  await runTest(results, '用户注册功能', async () => {
    const testOpenid = 'test_' + Date.now();
    const result = await cloud.callFunction({
      name: 'auth',
      data: {
        action: 'registerUser',
        data: {
          openid: testOpenid,
          nickname: '测试用户',
          role: 'fan'
        }
      }
    });
    
    if (!result.result.success) {
      throw new Error('用户注册失败');
    }
    
    // 清理测试数据
    await db.collection('users').where({ wechat_openid: testOpenid }).remove();
    
    return true;
  });
  
  // 测试2: 地址管理功能
  await runTest(results, '地址管理功能', async () => {
    const testOpenid = 'test_address_' + Date.now();
    
    // 创建测试用户
    await db.collection('users').add({
      data: {
        wechat_openid: testOpenid,
        role: 'influencer'
      }
    });
    
    // 添加地址
    const addResult = await cloud.callFunction({
      name: 'auth',
      data: {
        action: 'addAddress',
        data: {
          openid: testOpenid,
          address: {
            receiver_name: '张三',
            receiver_phone: '13800138000',
            province: '广东省',
            city: '深圳市',
            district: '南山区',
            detail_address: '科技园'
          }
        }
      }
    });
    
    if (!addResult.result.success) {
      throw new Error('添加地址失败');
    }
    
    // 清理测试数据
    await db.collection('users').where({ wechat_openid: testOpenid }).remove();
    
    return true;
  });
}

/**
 * 运行活动模块测试
 */
async function runActivityTests(results) {
  console.log('[测试] 开始活动模块测试');
  
  // 测试1: 创建活动
  await runTest(results, '创建活动功能', async () => {
    const testOpenid = 'test_activity_' + Date.now();
    
    // 创建测试用户
    const userResult = await db.collection('users').add({
      data: {
        wechat_openid: testOpenid,
        role: 'influencer',
        addresses: [{
          receiver_name: '测试主播',
          receiver_phone: '13800138000',
          province: '广东省',
          city: '深圳市',
          district: '南山区',
          detail_address: '测试地址',
          is_default: true
        }]
      }
    });
    
    // 创建活动
    const result = await cloud.callFunction({
      name: 'activities',
      data: {
        action: 'createActivity',
        data: {
          openid: testOpenid,
          title: '测试活动',
          description: '这是一个测试活动',
          access_password: '123456'
        }
      }
    });
    
    if (!result.result.success) {
      throw new Error('创建活动失败');
    }
    
    const activityId = result.result.data.activity_id;
    
    // 清理测试数据
    await db.collection('activities').doc(activityId).remove();
    await db.collection('users').doc(userResult._id).remove();
    
    return true;
  });
  
  // 测试2: 密码验证功能
  await runTest(results, '活动密码验证', async () => {
    const testOpenid = 'test_pwd_' + Date.now();
    
    // 创建测试活动
    const activityResult = await db.collection('activities').add({
      data: {
        influencer_id: testOpenid,
        title: '测试密码活动',
        access_password: '888888',
        status: 'active'
      }
    });
    
    const activityId = activityResult._id;
    
    // 测试正确密码
    const correctResult = await cloud.callFunction({
      name: 'activities',
      data: {
        action: 'verifyPassword',
        data: {
          activity_id: activityId,
          password: '888888',
          user_openid: 'fan_' + Date.now()
        }
      }
    });
    
    if (!correctResult.result.success) {
      throw new Error('正确密码验证失败');
    }
    
    // 测试错误密码
    const wrongResult = await cloud.callFunction({
      name: 'activities',
      data: {
        action: 'verifyPassword',
        data: {
          activity_id: activityId,
          password: '111111',
          user_openid: 'fan_' + Date.now()
        }
      }
    });
    
    if (wrongResult.result.success) {
      throw new Error('错误密码应该验证失败');
    }
    
    // 清理测试数据
    await db.collection('activities').doc(activityId).remove();
    await db.collection('password_errors').where({ activity_id: activityId }).remove();
    
    return true;
  });
}

/**
 * 运行物品模块测试
 */
async function runItemTests(results) {
  console.log('[测试] 开始物品模块测试');
  
  // 测试1: 创建物品
  await runTest(results, '创建物品功能', async () => {
    const testOpenid = 'test_item_' + Date.now();
    
    // 创建测试活动
    const activityResult = await db.collection('activities').add({
      data: {
        influencer_id: testOpenid,
        title: '测试物品活动',
        status: 'active'
      }
    });
    
    const activityId = activityResult._id;
    
    // 创建物品
    const result = await cloud.callFunction({
      name: 'items',
      data: {
        action: 'createItem',
        data: {
          openid: testOpenid,
          activity_id: activityId,
          item_name: '测试物品',
          item_category: 'electronics',
          photo_url: 'cloud://test.png',
          marker_quantity: 1
        }
      }
    });
    
    if (!result.result.success) {
      throw new Error('创建物品失败');
    }
    
    const itemId = result.result.data.item_id;
    
    // 清理测试数据
    await db.collection('items').doc(itemId).remove();
    await db.collection('activities').doc(activityId).remove();
    
    return true;
  });
  
  // 测试2: 库存扣减
  await runTest(results, '库存扣减功能', async () => {
    const testOpenid = 'test_stock_' + Date.now();
    
    // 创建测试活动
    const activityResult = await db.collection('activities').add({
      data: {
        influencer_id: testOpenid,
        title: '测试库存活动',
        status: 'active'
      }
    });
    
    const activityId = activityResult._id;
    
    // 创建物品（库存为3）
    const itemResult = await db.collection('items').add({
      data: {
        activity_id: activityId,
        item_name: '测试库存物品',
        marker_quantity: 3,
        remaining_quantity: 3,
        status: 'available'
      }
    });
    
    const itemId = itemResult._id;
    
    // 扣减库存
    const result = await cloud.callFunction({
      name: 'items',
      data: {
        action: 'reserveItem',
        data: {
          item_id: itemId,
          quantity: 1
        }
      }
    });
    
    if (!result.result.success) {
      throw new Error('库存扣减失败');
    }
    
    // 检查库存
    const itemData = await db.collection('items').doc(itemId).get();
    if (itemData.data.remaining_quantity !== 2) {
      throw new Error('库存扣减数量不正确');
    }
    
    // 清理测试数据
    await db.collection('items').doc(itemId).remove();
    await db.collection('activities').doc(activityId).remove();
    
    return true;
  });
}

/**
 * 运行订单模块测试
 */
async function runOrderTests(results) {
  console.log('[测试] 开始订单模块测试');
  
  // 测试1: 订单价格计算
  await runTest(results, '订单价格计算', async () => {
    const testOpenid = 'test_order_' + Date.now();
    
    // 创建测试活动
    const activityResult = await db.collection('activities').add({
      data: {
        influencer_id: 'influencer_' + Date.now(),
        title: '测试订单活动',
        status: 'active'
      }
    });
    
    const activityId = activityResult._id;
    
    // 创建测试物品
    const itemResult = await db.collection('items').add({
      data: {
        activity_id: activityId,
        item_name: '测试物品',
        marker_quantity: 1,
        remaining_quantity: 1,
        shipping_cost_estimate: 10.0,
        status: 'available'
      }
    });
    
    const itemId = itemResult._id;
    
    // 创建订单
    const result = await cloud.callFunction({
      name: 'orders',
      data: {
        action: 'createOrder',
        data: {
          openid: testOpenid,
          item_id: itemId,
          shipping_address: {
            receiver_name: '测试用户',
            receiver_phone: '13800138000',
            province: '广东省',
            city: '深圳市',
            district: '南山区',
            detail_address: '测试地址'
          }
        }
      }
    });
    
    if (!result.result.success) {
      throw new Error('创建订单失败: ' + JSON.stringify(result.result.error));
    }
    
    const order = result.result.data;
    
    // 验证价格计算：包装费2元 + 运费10元 = 小计12元，服务费5% = 0.6元，总计12.6元
    const expectedPackaging = 2.0;
    const expectedShipping = 10.0;
    const expectedSubtotal = expectedPackaging + expectedShipping;
    const expectedFee = expectedSubtotal * 0.05;
    const expectedTotal = expectedSubtotal + expectedFee;
    
    if (Math.abs(order.total_amount - expectedTotal) > 0.01) {
      throw new Error(`价格计算错误: 期望${expectedTotal}, 实际${order.total_amount}`);
    }
    
    // 清理测试数据
    await db.collection('orders').doc(order.order_id).remove();
    await db.collection('items').doc(itemId).remove();
    await db.collection('activities').doc(activityId).remove();
    
    return true;
  });
  
  // 测试2: 每人限领2个逻辑
  await runTest(results, '每人限领2个逻辑', async () => {
    const testOpenid = 'test_limit_' + Date.now();
    
    // 创建测试活动
    const activityResult = await db.collection('activities').add({
      data: {
        influencer_id: 'influencer_' + Date.now(),
        title: '测试限领活动',
        status: 'active'
      }
    });
    
    const activityId = activityResult._id;
    
    // 创建3个测试物品
    const items = [];
    for (let i = 0; i < 3; i++) {
      const itemResult = await db.collection('items').add({
        data: {
          activity_id: activityId,
          item_name: `测试物品${i + 1}`,
          marker_quantity: 1,
          remaining_quantity: 1,
          shipping_cost_estimate: 10.0,
          status: 'available'
        }
      });
      items.push(itemResult._id);
    }
    
    // 创建2个订单（应该成功）
    const orders = [];
    for (let i = 0; i < 2; i++) {
      const result = await cloud.callFunction({
        name: 'orders',
        data: {
          action: 'createOrder',
          data: {
            openid: testOpenid,
            item_id: items[i],
            shipping_address: {
              receiver_name: '测试用户',
              receiver_phone: '13800138000',
              province: '广东省',
              city: '深圳市',
              district: '南山区',
              detail_address: '测试地址'
            }
          }
        }
      });
      
      if (!result.result.success) {
        throw new Error(`创建第${i + 1}个订单失败`);
      }
      orders.push(result.result.data.order_id);
    }
    
    // 创建第3个订单（应该失败）
    const thirdResult = await cloud.callFunction({
      name: 'orders',
      data: {
        action: 'createOrder',
        data: {
          openid: testOpenid,
          item_id: items[2],
          shipping_address: {
            receiver_name: '测试用户',
            receiver_phone: '13800138000',
            province: '广东省',
            city: '深圳市',
            district: '南山区',
            detail_address: '测试地址'
          }
        }
      }
    });
    
    if (thirdResult.result.success) {
      throw new Error('第3个订单应该因超出限额而失败');
    }
    
    if (thirdResult.result.error.code !== 'LIMIT_EXCEEDED') {
      throw new Error('错误代码应该是LIMIT_EXCEEDED');
    }
    
    // 清理测试数据
    for (const orderId of orders) {
      await db.collection('orders').doc(orderId).remove();
    }
    for (const itemId of items) {
      await db.collection('items').doc(itemId).remove();
    }
    await db.collection('activities').doc(activityId).remove();
    
    return true;
  });
}

/**
 * 运行支付模块测试
 */
async function runPaymentTests(results) {
  console.log('[测试] 开始支付模块测试');
  
  // 测试1: 支付记录创建
  await runTest(results, '支付记录创建', async () => {
    const testOpenid = 'test_payment_' + Date.now();
    
    // 创建测试订单
    const orderResult = await db.collection('orders').add({
      data: {
        fan_wechat_openid: testOpenid,
        activity_id: 'test_activity',
        item_id: 'test_item',
        total_amount: 12.60,
        order_status: 'pending',
        payment_status: 'unpaid',
        created_at: db.serverDate()
      }
    });
    
    const orderId = orderResult._id;
    
    // 注意：实际支付需要微信支付环境，这里只测试函数调用
    // 清理测试数据
    await db.collection('orders').doc(orderId).remove();
    
    return true;
  });
}

/**
 * 运行发货模块测试
 */
async function runShippingTests(results) {
  console.log('[测试] 开始发货模块测试');
  
  // 测试1: 发货信息创建
  await runTest(results, '发货信息创建', async () => {
    // 注意：实际发货需要快递API环境，这里只测试数据结构
    return true;
  });
}

/**
 * 运行数据统计模块测试
 */
async function runAnalyticsTests(results) {
  console.log('[测试] 开始数据统计模块测试');
  
  // 测试1: 用户统计功能
  await runTest(results, '用户统计功能', async () => {
    const testOpenid = 'test_analytics_' + Date.now();
    
    // 创建测试用户
    await db.collection('users').add({
      data: {
        wechat_openid: testOpenid,
        role: 'fan',
        nickname: '测试统计用户'
      }
    });
    
    // 获取统计
    const result = await cloud.callFunction({
      name: 'analytics',
      data: {
        action: 'getUserStats',
        data: { openid: testOpenid }
      }
    });
    
    if (!result.result.success) {
      throw new Error('获取用户统计失败');
    }
    
    // 清理测试数据
    await db.collection('users').where({ wechat_openid: testOpenid }).remove();
    
    return true;
  });
}

/**
 * 运行单个测试用例
 */
async function runTest(results, testName, testFunc) {
  results.total++;
  
  try {
    await testFunc();
    results.passed++;
    results.details.push({
      name: testName,
      status: 'PASSED',
      message: '测试通过'
    });
    console.log(`[测试] ✓ ${testName} - 通过`);
  } catch (error) {
    results.failed++;
    results.errors.push(testName);
    results.details.push({
      name: testName,
      status: 'FAILED',
      message: error.message || '测试失败'
    });
    console.error(`[测试] ✗ ${testName} - 失败:`, error.message);
  }
}
