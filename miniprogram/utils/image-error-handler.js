// 图片加载错误处理工具
// 用于处理云存储图片403错误，提供重试机制和错误恢复

/**
 * 处理图片加载错误
 * @param {string} imageUrl - 图片URL
 * @param {string} fileId - 原始fileID（用于重新获取临时链接）
 * @param {Object} options - 配置选项
 * @returns {Promise<string>} - 返回有效的图片URL
 */
async function handleImageError(imageUrl, fileId, options = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onRetry = null,
    onError = null
  } = options;

  let retryCount = 0;

  // 检查URL是否有效
  function isValidUrl(url) {
    if (!url) return false;
    
    // 检查是否包含签名
    if (!url.includes('sign=')) {
      console.warn('[ImageErrorHandler] URL缺少签名:', url);
      return false;
    }
    
    // 检查是否过期
    try {
      // 在小程序环境中使用正则表达式解析URL
      const timestampMatch = url.match(/[?&]t=(\d+)/);
      if (!timestampMatch) {
        console.warn('[ImageErrorHandler] URL缺少时间戳:', url);
        return false;
      }
      
      const timestamp = parseInt(timestampMatch[1]);
      const currentTime = Math.floor(Date.now() / 1000);
      
      if ((currentTime - timestamp) > 7200) {
        console.warn('[ImageErrorHandler] URL已过期:', url);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('[ImageErrorHandler] 解析URL失败:', url, error);
      return false;
    }
  }

  // 获取新的临时链接
  async function getNewTempUrl(fileId) {
    try {
      // 直接使用传入的fileId，不进行任何转换
      console.log('[ImageErrorHandler] 获取临时链接，fileID:', fileId);
      
      const result = await wx.cloud.getTempFileURL({
        fileList: [fileId],
        maxAge: 86400 // 24小时有效期
      });
      
      console.log('[ImageErrorHandler] 获取临时链接结果:', result);
      
      if (result.fileList && result.fileList[0] && result.fileList[0].status === 0) {
        const newUrl = result.fileList[0].tempFileURL;
        if (isValidUrl(newUrl)) {
          return newUrl;
        }
      }
      
      throw new Error('获取临时链接失败');
    } catch (error) {
      console.error('[ImageErrorHandler] 获取临时链接出错:', error);
      throw error;
    }
  }

  // 重试逻辑
  async function retry() {
    retryCount++;
    
    if (onRetry) {
      onRetry(retryCount, maxRetries);
    }
    
    // 延迟重试
    if (retryDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
    
    try {
      const newUrl = await getNewTempUrl(fileId);
      console.log(`[ImageErrorHandler] 重试成功，第${retryCount}次尝试获取新URL`);
      return newUrl;
    } catch (error) {
      console.error(`[ImageErrorHandler] 第${retryCount}次重试失败:`, error);
      
      if (retryCount < maxRetries) {
        return retry();
      } else {
        if (onError) {
          onError(error, maxRetries);
        }
        throw new Error(`图片加载失败，已重试${maxRetries}次: ${error.message}`);
      }
    }
  }

  // 首先检查当前URL是否有效
  if (isValidUrl(imageUrl)) {
    return imageUrl;
  }
  
  // 如果无效，尝试重试
  return retry();
}

/**
 * 批量处理图片URL
 * @param {Array} imageList - 图片列表，每个元素包含{url, fileId}
 * @param {Object} options - 配置选项
 * @returns {Promise<Array>} - 返回处理后的图片列表
 */
async function batchHandleImageErrors(imageList, options = {}) {
  const {
    concurrency = 3, // 并发数
    onProgress = null,
    ...handleOptions
  } = options;

  const results = [];
  const total = imageList.length;
  let completed = 0;

  // 分批处理
  for (let i = 0; i < imageList.length; i += concurrency) {
    const batch = imageList.slice(i, i + concurrency);
    
    const batchPromises = batch.map(async (image, index) => {
      try {
        const validUrl = await handleImageError(image.url, image.fileId, handleOptions);
        completed++;
        
        if (onProgress) {
          onProgress(completed, total);
        }
        
        return {
          ...image,
          url: validUrl,
          success: true
        };
      } catch (error) {
        completed++;
        
        if (onProgress) {
          onProgress(completed, total);
        }
        
        return {
          ...image,
          url: image.url, // 保留原始URL
          success: false,
          error: error.message
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
}

module.exports = {
  handleImageError,
  batchHandleImageErrors
};