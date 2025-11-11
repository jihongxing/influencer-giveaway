// components/qr-scanner/qr-scanner.js
Component({
  properties: {
    // Component properties
  },

  data: {
    scanning: false,
  },

  methods: {
    onScanQRCode() {
      this.setData({ scanning: true });

      wx.scanCode({
        onlyFromCamera: true,
        scanType: ['qrCode'],
        success: (res) => {
          this.setData({ scanning: false });
          this.triggerEvent('scan', { qrCode: res.result });
        },
        fail: (err) => {
          this.setData({ scanning: false });
          if (err.errMsg && !err.errMsg.includes('cancel')) {
            wx.showToast({
              title: '扫描失败',
              icon: 'none',
            });
          }
        },
      });
    },
  },
});

