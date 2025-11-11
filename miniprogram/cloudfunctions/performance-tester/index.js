// 性能测试和优化检测云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 性能测试主入口
 */
exports.main = async (event, context) => {
  const { testType } = event;
  
  console.log('[性能测试] 开始执行:', testType);
  
  const results = {
    test_type: testType || 'all',
    timestamp: new Date().toISOString(),
    metrics: []
  };
  
  try {
    if (testType === 'database' || !testType) {
      await testDatabasePerformance(results);
    }
    
    if (testType === 'cloudfunction' || !testType) {
      await testCloudFunctionPerformance(results);
    }
    
    if (testType === 'storage' || !testType) {
      await testStoragePerformance(results);
    }
    
    // 生成性能报告
    const report = generatePerformanceReport(results);
    
    return {
      success: true,
      data: {
        results,
        report
      }
    };
    
  } catch (error) {
    console.error('[性能测试] 测试失败:', error);
    return {
      success: false,
      error: {
        code: 'PERFORMANCE_TEST_FAILED',
        message: error.message
      }
    };
  }
};

/**
 * 数据库性能测试
 */
async function testDatabasePerformance(results) {
  console.log('[性能测试] 数据库性能测试');
  
  // 测试1: 单条记录查询性能
  const singleQueryStart = Date.now();
  await db.collection('users').limit(1).get();
  const singleQueryTime = Date.now() - singleQueryStart;
  
  results.metrics.push({
    name: '数据库单条查询',
    category: 'database',
    duration_ms: singleQueryTime,
    status: singleQueryTime < 100 ? 'EXCELLENT' : singleQueryTime < 300 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
  });
  
  // 测试2: 批量查询性能
  const batchQueryStart = Date.now();
  await db.collection('items').limit(20).get();
  const batchQueryTime = Date.now() - batchQueryStart;
  
  results.metrics.push({
    name: '数据库批量查询(20条)',
    category: 'database',
    duration_ms: batchQueryTime,
    status: batchQueryTime < 200 ? 'EXCELLENT' : batchQueryTime < 500 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
  });
  
  // 测试3: 聚合查询性能
  const aggregateStart = Date.now();
  await db.collection('orders').count();
  const aggregateTime = Date.now() - aggregateStart;
  
  results.metrics.push({
    name: '数据库聚合查询(count)',
    category: 'database',
    duration_ms: aggregateTime,
    status: aggregateTime < 150 ? 'EXCELLENT' : aggregateTime < 400 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
  });
  
  // 测试4: 复杂查询性能（带条件和排序）
  const complexQueryStart = Date.now();
  await db.collection('activities')
    .where({ status: 'active' })
    .orderBy('created_at', 'desc')
    .limit(10)
    .get();
  const complexQueryTime = Date.now() - complexQueryStart;
  
  results.metrics.push({
    name: '数据库复杂查询(条件+排序)',
    category: 'database',
    duration_ms: complexQueryTime,
    status: complexQueryTime < 200 ? 'EXCELLENT' : complexQueryTime < 500 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
  });
  
  // 测试5: 事务性能
  const transactionStart = Date.now();
  const transaction = await db.startTransaction();
  await transaction.collection('users').limit(1).get();
  await transaction.commit();
  const transactionTime = Date.now() - transactionStart;
  
  results.metrics.push({
    name: '数据库事务处理',
    category: 'database',
    duration_ms: transactionTime,
    status: transactionTime < 300 ? 'EXCELLENT' : transactionTime < 600 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
  });
}

/**
 * 云函数调用性能测试
 */
async function testCloudFunctionPerformance(results) {
  console.log('[性能测试] 云函数性能测试');
  
  // 测试1: 简单云函数调用
  const simpleCallStart = Date.now();
  await cloud.callFunction({
    name: 'analytics',
    data: {
      action: 'getPlatformStats'
    }
  });
  const simpleCallTime = Date.now() - simpleCallStart;
  
  results.metrics.push({
    name: '云函数简单调用',
    category: 'cloudfunction',
    duration_ms: simpleCallTime,
    status: simpleCallTime < 500 ? 'EXCELLENT' : simpleCallTime < 1000 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
  });
  
  // 测试2: 数据密集型云函数调用
  const dataIntensiveStart = Date.now();
  await cloud.callFunction({
    name: 'activities',
    data: {
      action: 'getActivities',
      data: {
        filter: 'all',
        page: 1,
        page_size: 20
      }
    }
  });
  const dataIntensiveTime = Date.now() - dataIntensiveStart;
  
  results.metrics.push({
    name: '云函数数据密集型调用',
    category: 'cloudfunction',
    duration_ms: dataIntensiveTime,
    status: dataIntensiveTime < 800 ? 'EXCELLENT' : dataIntensiveTime < 1500 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
  });
}

/**
 * 云存储性能测试
 */
async function testStoragePerformance(results) {
  console.log('[性能测试] 云存储性能测试');
  
  // 测试1: 获取临时链接性能
  try {
    const getTempUrlStart = Date.now();
    await cloud.getTempFileURL({
      fileList: ['cloud://test-file.png']
    });
    const getTempUrlTime = Date.now() - getTempUrlStart;
    
    results.metrics.push({
      name: '云存储获取临时链接',
      category: 'storage',
      duration_ms: getTempUrlTime,
      status: getTempUrlTime < 300 ? 'EXCELLENT' : getTempUrlTime < 600 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
    });
  } catch (error) {
    // 文件不存在时跳过
    console.log('[性能测试] 云存储测试跳过（无测试文件）');
  }
}

/**
 * 生成性能报告
 */
function generatePerformanceReport(results) {
  const report = {
    total_tests: results.metrics.length,
    excellent: 0,
    good: 0,
    needs_improvement: 0,
    recommendations: []
  };
  
  // 统计各状态数量
  results.metrics.forEach(metric => {
    if (metric.status === 'EXCELLENT') {
      report.excellent++;
    } else if (metric.status === 'GOOD') {
      report.good++;
    } else {
      report.needs_improvement++;
    }
  });
  
  // 生成优化建议
  const slowMetrics = results.metrics.filter(m => m.status === 'NEEDS_IMPROVEMENT');
  
  if (slowMetrics.length > 0) {
    report.recommendations.push({
      category: 'optimization',
      priority: 'HIGH',
      message: `发现${slowMetrics.length}个性能问题需要优化`,
      items: slowMetrics.map(m => m.name)
    });
  }
  
  // 数据库优化建议
  const dbMetrics = results.metrics.filter(m => m.category === 'database');
  const avgDbTime = dbMetrics.reduce((sum, m) => sum + m.duration_ms, 0) / dbMetrics.length;
  
  if (avgDbTime > 300) {
    report.recommendations.push({
      category: 'database',
      priority: 'MEDIUM',
      message: '数据库平均查询时间较长，建议优化',
      suggestions: [
        '检查是否需要添加索引',
        '优化复杂查询的查询条件',
        '考虑使用缓存机制',
        '减少不必要的字段返回'
      ]
    });
  }
  
  // 云函数优化建议
  const cfMetrics = results.metrics.filter(m => m.category === 'cloudfunction');
  const avgCfTime = cfMetrics.reduce((sum, m) => sum + m.duration_ms, 0) / cfMetrics.length;
  
  if (avgCfTime > 1000) {
    report.recommendations.push({
      category: 'cloudfunction',
      priority: 'MEDIUM',
      message: '云函数平均响应时间较长，建议优化',
      suggestions: [
        '优化云函数代码逻辑',
        '减少不必要的数据库查询',
        '考虑异步处理耗时操作',
        '使用并发查询代替串行查询'
      ]
    });
  }
  
  // 总体评分
  const totalScore = (report.excellent * 100 + report.good * 70 + report.needs_improvement * 30) / report.total_tests;
  report.overall_score = totalScore.toFixed(2);
  report.overall_grade = totalScore >= 90 ? 'A' : totalScore >= 80 ? 'B' : totalScore >= 70 ? 'C' : 'D';
  
  return report;
}
