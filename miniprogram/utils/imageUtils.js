// utils/imageUtils.js
/**
 * Compress image before upload
 */
function compressImage(filePath) {
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src: filePath,
      quality: 80,
      success: (res) => {
        resolve(res.tempFilePath);
      },
      fail: reject,
    });
  });
}

module.exports = {
  compressImage,
};

