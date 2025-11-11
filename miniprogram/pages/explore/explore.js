// pages/explore/explore.js
const apiService = require('../../services/api-cloud').default;

Page({
  data: {
    activities: [],
    loading: true,
    page: 1,
    limit: 20,
    hasMore: true,
    category: '', // 分类筛选
    sort: 'latest', // 排序：latest, popular, shipping_low
    status: 'active', // 状态筛选：active, all
  },

  onLoad() {
    this.loadActivities();
  },

  onShow() {
    // 每次显示时刷新（可能从筛选页面返回）
    this.setData({ page: 1, activities: [], hasMore: true });
    this.loadActivities();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, activities: [], hasMore: true });
    this.loadActivities().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadActivities();
    }
  },

  async loadActivities() {
    if (this.data.loading && this.data.page > 1) {
      return; // Already loading
    }

    this.setData({ loading: true });

    try {
      const params = {
        page: this.data.page,
        limit: this.data.limit,
        status: this.data.status === 'all' ? undefined : this.data.status,
      };

      if (this.data.category) {
        params.category = this.data.category;
      }

      // 过滤undefined参数
      const filteredParams = Object.keys(params)
        .filter((key) => params[key] !== undefined)
        .reduce((acc, key) => {
          acc[key] = params[key];
          return acc;
        }, {});

      const response = await apiService.getPublicActivities(filteredParams);

      if (response.success) {
        const newActivities = response.data.activities || [];
        const pagination = response.data.pagination || {};

        this.setData({
          activities: this.data.page === 1 ? newActivities : [...this.data.activities, ...newActivities],
          hasMore: pagination && pagination.page && pagination.total_pages ? pagination.page < pagination.total_pages : false,
          loading: false,
        });
      } else {
        throw new Error(response.error?.message || '加载失败');
      }
    } catch (error) {
      console.error('Load activities error:', error);
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none',
      });
      this.setData({ loading: false });
    }
  },

  onCategoryChange(e) {
    const category = e.currentTarget.dataset.category || '';
    this.setData({ category, page: 1, activities: [], hasMore: true });
    this.loadActivities();
  },

  onSortChange(e) {
    const sort = e.currentTarget.dataset.sort || 'latest';
    this.setData({ sort, page: 1, activities: [], hasMore: true });
    // TODO: 实现排序逻辑
    this.loadActivities();
  },

  onStatusChange(e) {
    const status = e.currentTarget.dataset.status || 'active';
    this.setData({ status, page: 1, activities: [], hasMore: true });
    this.loadActivities();
  },

  onActivityTap(e) {
    const activityId = e.currentTarget.dataset.id;
    const linkId = e.currentTarget.dataset.linkId;
    
    // 跳转到活动详情页
    wx.navigateTo({
      url: `/pages/activity-detail/activity-detail?id=${activityId}&link_id=${linkId}`,
    });
  },

  onSearch() {
    // TODO: 实现搜索功能
    wx.showToast({
      title: '搜索功能开发中',
      icon: 'none',
    });
  },
});

