// 云存储权限测试云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { action, data } = event;
  
  try {
    switch (action) {
      case 'testPermissions':
        return await testStoragePermissions();
      case 'testFileAccess':
        return await testFileAccess(data);
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
    console.error('Storage test function error:', error);
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
 * 测试云存储基本权限
 */
async function testStoragePermissions() {
  try {
    console.log('[Storage Test] 开始测试云存储权限');
    
    // 1. 测试数据库访问权限
    const dbTest = await db.collection('activities').limit(1).get();
    console.log('[Storage Test] 数据库访问测试通过');
    
    // 2. 测试云存储访问权限
    // 尝试获取一个测试文件的临时链接
    const testResult = await cloud.getTempFileURL({
      fileList: ['cloud://test-file.png']
    });
    
    console.log('[Storage Test] 临时链接获取结果:', testResult);
    
    return {
      success: true,
      data: {
        databaseAccess: true,
        storageAccess: testResult.fileList && testResult.fileList.length > 0,
        testResult: testResult
      }
    };
  } catch (error) {
    console.error('[Storage Test] 权限测试失败:', error);
    return {
      success: false,
      error: {
        code: 'PERMISSION_ERROR',
        message: error.message || '权限测试失败'
      }
    };
  }
}

/**
 * 测试特定文件访问权限
 */
async function testFileAccess(data) {
  const { fileIds } = data;
  
  if (!fileIds || !Array.isArray(fileIds)) {
    return {
      success: false,
      error: {
        code: 'INVALID_PARAMS',
        message: 'fileIds 参数无效'
      }
    };
  }
  
  try {
    console.log('[Storage Test] 测试文件访问权限:', fileIds);
    
    const result = await cloud.getTempFileURL({
      fileList: fileIds
    });
    
    console.log('[Storage Test] 文件访问测试结果:', result);
    
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('[Storage Test] 文件访问测试失败:', error);
    return {
      success: false,
      error: {
        code: 'FILE_ACCESS_ERROR',
        message: error.message || '文件访问测试失败'
      }
    };
  }
}