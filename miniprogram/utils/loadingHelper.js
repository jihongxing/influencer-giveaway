// miniprogram/utils/loadingHelper.js
// Loading state and error handling helper

/**
 * Show loading with message
 */
export function showLoading(message = '加载中...') {
  wx.showLoading({
    title: message,
    mask: true,
  });
}

/**
 * Hide loading
 */
export function hideLoading() {
  wx.hideLoading();
}

/**
 * Show error toast
 */
export function showError(message, duration = 2000) {
  wx.showToast({
    title: message,
    icon: 'none',
    duration,
  });
}

/**
 * Show success toast
 */
export function showSuccess(message, duration = 2000) {
  wx.showToast({
    title: message,
    icon: 'success',
    duration,
  });
}

/**
 * Handle API error
 */
export function handleApiError(error, defaultMessage = '操作失败') {
  console.error('API Error:', error);
  
  let message = defaultMessage;
  
  if (error && error.message) {
    message = error.message;
  } else if (error && error.error && error.error.message) {
    message = error.error.message;
  }
  
  showError(message);
  return message;
}

/**
 * Safe async wrapper with loading and error handling
 */
export async function safeAsync(fn, loadingMessage = '加载中...', errorMessage = '操作失败') {
  showLoading(loadingMessage);
  
  try {
    const result = await fn();
    hideLoading();
    return { success: true, data: result };
  } catch (error) {
    hideLoading();
    const message = handleApiError(error, errorMessage);
    return { success: false, error: message };
  }
}

module.exports = {
  showLoading,
  hideLoading,
  showError,
  showSuccess,
  handleApiError,
  safeAsync,
};

