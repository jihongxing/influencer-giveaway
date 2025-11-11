// pages/test-auth/test-auth.js
Page({
  data: {
    testResult: '',
    loading: false
  },

  onLoad() {
    this.testStoragePermissions();
  },

  async testStoragePermissions() {
    this.setData({ loading: true, testResult: '测试中...' });

    try {
      // 测试1: 检查云开发是否已初始化
      if (!wx.cloud) {
        throw new Error('云开发未初始化');
      }

      // 测试2: 调用云函数测试存储权限
      wx.showLoading({ title: '测试中...' });
      
      const result = await wx.cloud.callFunction({
        name: 'test-storage',
        data: {
          action: 'testPermissions'
        }
      });
      
      wx.hideLoading();
      
      console.log('[Test Auth] 云函数测试结果:', result);
      
      if (result.result.success) {
        const data = result.result.data;
        let resultText = '✅ 云存储权限测试通过\n\n';
        
        resultText += '数据库访问: ' + (data.databaseAccess ? '✅ 正常' : '❌ 异常') + '\n';
        resultText += '云存储访问: ' + (data.storageAccess ? '✅ 正常' : '❌ 异常') + '\n\n';
        
        if (data.testResult && data.testResult.fileList) {
          resultText += '文件列表测试结果:\n';
          data.testResult.fileList.forEach((file, index) => {
            resultText += `  文件${index + 1}: 状态码 ${file.status}\n`;
            if (file.tempFileURL) {
              resultText += `    临时链接: ${file.tempFileURL}\n`;
            }
            if (file.errMsg) {
              resultText += `    错误信息: ${file.errMsg}\n`;
            }
          });
        }
        
        this.setData({
          testResult: resultText,
          loading: false
        });
      } else {
        this.setData({
          testResult: '❌ 云函数测试失败\n错误代码: ' + (result.result.error.code || '未知') + '\n错误信息: ' + (result.result.error.message || '未知错误'),
          loading: false
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('[Test Auth] 测试失败:', error);
      this.setData({
        testResult: '❌ 测试失败\n错误信息: ' + (error.message || '未知错误'),
        loading: false
      });
    }
  },

  async testSpecificFiles() {
    this.setData({ loading: true });
    
    try {
      // 获取一些实际存在的文件ID进行测试
      // 这里需要从数据库中获取真实的文件ID
      wx.showLoading({ title: '获取文件列表...' });
      
      // 先获取一些活动数据来获取真实的文件ID
      const activitiesResult = await wx.cloud.callFunction({
        name: 'activities',
        data: {
          action: 'getPublicList',
          data: {
            page: 1,
            limit: 3
          }
        }
      });
      
      wx.hideLoading();
      
      if (!activitiesResult.result.success) {
        throw new Error('获取活动列表失败: ' + (activitiesResult.result.error.message || '未知错误'));
      }
      
      // 收集文件ID
      const fileIds = [];
      const activities = activitiesResult.result.data.activities || [];
      
      activities.forEach(activity => {
        // 收集封面图
        if (activity.cover_image_url && activity.cover_image_url.startsWith('cloud://')) {
          fileIds.push(activity.cover_image_url);
        }
        
        // 收集物品图片
        if (activity.items && Array.isArray(activity.items)) {
          activity.items.forEach(item => {
            if (item.photo_urls && Array.isArray(item.photo_urls)) {
              item.photo_urls.forEach(photoUrl => {
                if (photoUrl && photoUrl.startsWith('cloud://')) {
                  fileIds.push(photoUrl);
                }
              });
            }
          });
        }
      });
      
      if (fileIds.length === 0) {
        this.setData({
          testResult: this.data.testResult + '\n\n⚠️ 未找到可测试的云存储文件'
        });
        return;
      }
      
      // 测试这些文件的访问权限
      this.setData({
        testResult: this.data.testResult + '\n\n🔍 测试实际文件访问...\n找到 ' + fileIds.length + ' 个文件'
      });
      
      wx.showLoading({ title: '测试文件访问...' });
      
      const fileTestResult = await wx.cloud.callFunction({
        name: 'test-storage',
        data: {
          action: 'testFileAccess',
          data: {
            fileIds: fileIds.slice(0, 5) // 限制测试数量
          }
        }
      });
      
      wx.hideLoading();
      
      if (fileTestResult.result.success) {
        let fileResultText = '\n\n📄 文件访问测试结果:\n';
        const fileList = fileTestResult.result.data.fileList || [];
        
        fileList.forEach((file, index) => {
          fileResultText += `文件${index + 1}:\n`;
          fileResultText += `  状态: ${file.status === 0 ? '✅ 成功' : '❌ 失败'}\n`;
          if (file.tempFileURL) {
            fileResultText += `  临时链接: ${file.tempFileURL.substring(0, 100)}...\n`;
          }
          if (file.errMsg) {
            fileResultText += `  错误: ${file.errMsg}\n`;
          }
        });
        
        this.setData({
          testResult: this.data.testResult + fileResultText
        });
      } else {
        this.setData({
          testResult: this.data.testResult + '\n\n❌ 文件访问测试失败: ' + (fileTestResult.result.error.message || '未知错误')
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('[Test Auth] 文件测试失败:', error);
      this.setData({
        testResult: this.data.testResult + '\n\n❌ 文件测试失败: ' + (error.message || '未知错误'),
        loading: false
      });
    }
  },

  onRetry() {
    this.testStoragePermissions();
  },
  
  onTestFiles() {
    this.testSpecificFiles();
  }
});     testResult: '❌ 测试失败\n错误信息: ' + (error.message || '未知错误'),
        loading: false
      });
    }
  },

  async testSpecificFiles() {
    this.setData({ loading: true });
    
    try {
      // 获取一些实际存在的文件ID进行测试
      // 这里需要从数据库中获取真实的文件ID
      wx.showLoading({ title: '获取文件列表...' });
      
      // 先获取一些活动数据来获取真实的文件ID
      const activitiesResult = await wx.cloud.callFunction({
        name: 'activities',
        data: {
          action: 'getPublicList',
          data: {
            page: 1,
            limit: 3
          }
        }
      });
      
      wx.hideLoading();
      
      if (!activitiesResult.result.success) {
        throw new Error('获取活动列表失败: ' + (activitiesResult.result.error.message || '未知错误'));
      }
      
      // 收集文件ID
      const fileIds = [];
      const activities = activitiesResult.result.data.activities || [];
      
      activities.forEach(activity => {
        // 收集封面图
        if (activity.cover_image_url && activity.cover_image_url.startsWith('cloud://')) {
          fileIds.push(activity.cover_image_url);
        }
        
        // 收集物品图片
        if (activity.items && Array.isArray(activity.items)) {
          activity.items.forEach(item => {
            if (item.photo_urls && Array.isArray(item.photo_urls)) {
              item.photo_urls.forEach(photoUrl => {
                if (photoUrl && photoUrl.startsWith('cloud://')) {
                  fileIds.push(photoUrl);
                }
              });
            }
          });
        }
      });
      
      if (fileIds.length === 0) {
        this.setData({
          testResult: this.data.testResult + '\n\n⚠️ 未找到可测试的云存储文件'
        });
        return;
      }
      
      // 测试这些文件的访问权限
      this.setData({
        testResult: this.data.testResult + '\n\n🔍 测试实际文件访问...\n找到 ' + fileIds.length + ' 个文件'
      });
      
      wx.showLoading({ title: '测试文件访问...' });
      
      const fileTestResult = await wx.cloud.callFunction({
        name: 'test-storage',
        data: {
          action: 'testFileAccess',
          data: {
            fileIds: fileIds.slice(0, 5) // 限制测试数量
          }
        }
      });
      
      wx.hideLoading();
      
      if (fileTestResult.result.success) {
        let fileResultText = '\n\n📄 文件访问测试结果:\n';
        const fileList = fileTestResult.result.data.fileList || [];
        
        fileList.forEach((file, index) => {
          fileResultText += `文件${index + 1}:\n`;
          fileResultText += `  状态: ${file.status === 0 ? '✅ 成功' : '❌ 失败'}\n`;
          if (file.tempFileURL) {
            fileResultText += `  临时链接: ${file.tempFileURL.substring(0, 100)}...\n`;
          }
          if (file.errMsg) {
            fileResultText += `  错误: ${file.errMsg}\n`;
          }
        });
        
        this.setData({
          testResult: this.data.testResult + fileResultText
        });
      } else {
        this.setData({
          testResult: this.data.testResult + '\n\n❌ 文件访问测试失败: ' + (fileTestResult.result.error.message || '未知错误')
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('[Test Auth] 文件测试失败:', error);
      this.setData({
        testResult: this.data.testResult + '\n\n❌ 文件测试失败: ' + (error.message || '未知错误'),
        loading: false
      });
    }
  },

  onRetry() {
    this.testStoragePermissions();
  },
  
  onTestFiles() {
    this.testSpecificFiles();
  }
});