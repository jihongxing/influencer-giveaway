// components/activity-timeline/activity-timeline.js
const apiService = require('../../services/api').default;

Component({
  properties: {
    influencerId: {
      type: Number,
      required: true,
    },
    platformType: {
      type: String,
      value: '', // Optional filter
    },
  },

  data: {
    activities: [],
    loading: true,
    page: 1,
    limit: 20,
    hasMore: true,
  },

  lifetimes: {
    attached() {
      this.loadActivities();
    },
  },

  methods: {
    async loadActivities() {
      if (this.data.loading && this.data.page > 1) {
        return;
      }

      this.setData({ loading: true });

      try {
        const params = {
          influencer_id: this.properties.influencerId,
          page: this.data.page,
          limit: this.data.limit,
        };
        if (this.properties.platformType) {
          params.platform_type = this.properties.platformType;
        }

        const queryString = Object.keys(params)
          .map((key) => `${key}=${params[key]}`)
          .join('&');

        const response = await apiService.get(`/external-activities?${queryString}`);

        if (response.success) {
          const newActivities = response.data.activities || [];
          const pagination = response.data.pagination || {};

          this.setData({
            activities:
              this.data.page === 1
                ? newActivities
                : [...this.data.activities, ...newActivities],
            hasMore: pagination.page < pagination.total_pages,
            loading: false,
          });
        } else {
          throw new Error(response.error?.message || '加载失败');
        }
      } catch (error) {
        console.error('Load activities error:', error);
        this.setData({ loading: false });
        this.triggerEvent('error', { message: error.message });
      }
    },

    onLoadMore() {
      if (this.data.hasMore && !this.data.loading) {
        this.setData({ page: this.data.page + 1 });
        this.loadActivities();
      }
    },

    onActivityTap(e) {
      const activity = e.currentTarget.dataset.activity;
      if (activity.link_url) {
        // Open external link
        // Note: In WeChat Mini Program, you might need to use web-view component
        // or copy link to clipboard
        wx.setClipboardData({
          data: activity.link_url,
          success: () => {
            wx.showToast({
              title: '链接已复制',
              icon: 'success',
            });
          },
        });
      }
    },
  },
});

