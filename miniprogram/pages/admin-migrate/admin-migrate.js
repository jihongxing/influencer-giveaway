// pages/admin-migrate/admin-migrate.js
Page({
  data: {
    migrating: false,
    result: null,
    logs: []
  },

  // 运行迁移
  onRunMigration() {
    this.setData({
      migrating: true,
      result: null,
      logs: ['开始执行迁移...']
    });

    wx.cloud.callFunction({
      name: 'db-init',
      data: {}
    }).then(res => {
      console.log('迁移结果:', res);
      
      this.setData({
        migrating: false,
        result: res.result,
        logs: [
          ...this.data.logs,
          '迁移完成！',
          `Activities: 总共${res.result.data.activities.total}条，成功${res.result.data.activities.migrated}条`,
          `Items: 总共${res.result.data.items.total}条，成功${res.result.data.items.migrated}条`
        ]
      });

      wx.showToast({
        title: '迁移成功',
        icon: 'success'
      });
    }).catch(err => {
      console.error('迁移失败:', err);
      
      this.setData({
        migrating: false,
        logs: [
          ...this.data.logs,
          '迁移失败: ' + err.message
        ]
      });

      wx.showToast({
        title: '迁移失败',
        icon: 'none'
      });
    });
  }
});
