// miniprogram/utils/offlineSync.js
// Offline support and data synchronization utility

class OfflineSync {
  constructor() {
    this.syncQueue = [];
    this.isOnline = true;
    this.maxRetries = 3;
    this.syncInterval = 5000; // 5 seconds
    this.intervalId = null;
    this.init();
  }

  /**
   * Initialize offline sync
   */
  init() {
    // Load sync queue from storage
    this.loadSyncQueue();

    // Monitor network status
    wx.onNetworkStatusChange((res) => {
      this.isOnline = res.isConnected;
      if (this.isOnline) {
        this.startSync();
      } else {
        this.stopSync();
      }
    });

    // Check initial network status
    wx.getNetworkType({
      success: (res) => {
        this.isOnline = res.networkType !== 'none';
        if (this.isOnline) {
          this.startSync();
        }
      },
    });
  }

  /**
   * Add task to sync queue
   */
  addTask(type, endpoint, data) {
    const task = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      endpoint,
      data,
      timestamp: Date.now(),
      retries: 0,
    };

    this.syncQueue.push(task);
    this.saveSyncQueue();

    // Try to sync immediately if online
    if (this.isOnline) {
      this.syncTask(task);
    }

    return task.id;
  }

  /**
   * Sync a single task
   */
  async syncTask(task) {
    try {
      const apiService = require('./api').default;
      let response;

      switch (task.type) {
        case 'create':
          response = await apiService.post(task.endpoint, task.data);
          break;
        case 'update':
          response = await apiService.put(task.endpoint, task.data);
          break;
        case 'delete':
          response = await apiService.delete(task.endpoint);
          break;
      }

      if (response && response.success) {
        // Remove task from queue
        this.removeTask(task.id);
        return true;
      } else {
        // Retry if failed
        task.retries++;
        if (task.retries < this.maxRetries) {
          this.saveSyncQueue();
          return false;
        } else {
          // Max retries reached, remove task
          this.removeTask(task.id);
          return false;
        }
      }
    } catch (error) {
      console.error('Sync task error:', error);
      task.retries++;
      if (task.retries < this.maxRetries) {
        this.saveSyncQueue();
        return false;
      } else {
        this.removeTask(task.id);
        return false;
      }
    }
  }

  /**
   * Start sync interval
   */
  startSync() {
    if (this.intervalId !== null) {
      return; // Already running
    }

    this.intervalId = setInterval(() => {
      this.syncAll();
    }, this.syncInterval);
  }

  /**
   * Stop sync interval
   */
  stopSync() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Sync all pending tasks
   */
  async syncAll() {
    if (!this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    const tasks = [...this.syncQueue];
    for (const task of tasks) {
      await this.syncTask(task);
    }
  }

  /**
   * Remove task from queue
   */
  removeTask(taskId) {
    this.syncQueue = this.syncQueue.filter((task) => task.id !== taskId);
    this.saveSyncQueue();
  }

  /**
   * Load sync queue from storage
   */
  loadSyncQueue() {
    try {
      const data = wx.getStorageSync('offline_sync_queue');
      if (data) {
        this.syncQueue = JSON.parse(data);
      }
    } catch (error) {
      console.error('Load sync queue error:', error);
      this.syncQueue = [];
    }
  }

  /**
   * Save sync queue to storage
   */
  saveSyncQueue() {
    try {
      wx.setStorageSync('offline_sync_queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Save sync queue error:', error);
    }
  }

  /**
   * Get pending tasks count
   */
  getPendingCount() {
    return this.syncQueue.length;
  }

  /**
   * Clear all pending tasks
   */
  clearQueue() {
    this.syncQueue = [];
    this.saveSyncQueue();
  }

  /**
   * Check if online
   */
  isConnected() {
    return this.isOnline;
  }
}

// Create singleton instance
let offlineSyncInstance = null;

function getOfflineSync() {
  if (!offlineSyncInstance) {
    offlineSyncInstance = new OfflineSync();
  }
  return offlineSyncInstance;
}

module.exports = getOfflineSync;

