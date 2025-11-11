// miniprogram/utils/offlineSync.ts
// Offline support and data synchronization utility

interface SyncTask {
  id: string;
  type: 'create' | 'update' | 'delete';
  endpoint: string;
  data: any;
  timestamp: number;
  retries: number;
}

class OfflineSync {
  private syncQueue: SyncTask[] = [];
  private isOnline: boolean = true;
  private maxRetries: number = 3;
  private syncInterval: number = 5000; // 5 seconds
  private intervalId: number | null = null;

  constructor() {
    this.init();
  }

  /**
   * Initialize offline sync
   */
  private init(): void {
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
  addTask(type: SyncTask['type'], endpoint: string, data: any): string {
    const task: SyncTask = {
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
  private async syncTask(task: SyncTask): Promise<boolean> {
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
  private startSync(): void {
    if (this.intervalId !== null) {
      return; // Already running
    }

    this.intervalId = setInterval(() => {
      this.syncAll();
    }, this.syncInterval) as any;
  }

  /**
   * Stop sync interval
   */
  private stopSync(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Sync all pending tasks
   */
  async syncAll(): Promise<void> {
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
  private removeTask(taskId: string): void {
    this.syncQueue = this.syncQueue.filter((task) => task.id !== taskId);
    this.saveSyncQueue();
  }

  /**
   * Load sync queue from storage
   */
  private loadSyncQueue(): void {
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
  private saveSyncQueue(): void {
    try {
      wx.setStorageSync('offline_sync_queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Save sync queue error:', error);
    }
  }

  /**
   * Get pending tasks count
   */
  getPendingCount(): number {
    return this.syncQueue.length;
  }

  /**
   * Clear all pending tasks
   */
  clearQueue(): void {
    this.syncQueue = [];
    this.saveSyncQueue();
  }

  /**
   * Check if online
   */
  isConnected(): boolean {
    return this.isOnline;
  }
}

// Create singleton instance
let offlineSyncInstance: OfflineSync | null = null;

export function getOfflineSync(): OfflineSync {
  if (!offlineSyncInstance) {
    offlineSyncInstance = new OfflineSync();
  }
  return offlineSyncInstance;
}

export default getOfflineSync;

