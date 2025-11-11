// pages/sharing-area/sharing-area.js
const apiService = require('../../services/api-cloud').default;

Page({
  data: {
    activityId: null,
    influencerId: null,
    posts: [],
    loading: true,
    page: 1,
    limit: 20,
    hasMore: true,
  },

  onLoad(options) {
    const activityId = options.activity_id;
    const influencerId = options.influencer_id;

    if (activityId) {
      this.setData({ activityId: parseInt(activityId, 10) });
    } else if (influencerId) {
      this.setData({ influencerId: parseInt(influencerId, 10) });
    }

    this.loadPosts();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, posts: [], hasMore: true });
    this.loadPosts().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadPosts();
    }
  },

  async loadPosts() {
    if (this.data.loading && this.data.page > 1) {
      return; // Already loading
    }

    this.setData({ loading: true });

    try {
      const params = {
        page: this.data.page,
        limit: this.data.limit,
      };
      if (this.data.activityId) {
        params.activity_id = this.data.activityId;
      }
      if (this.data.influencerId) {
        params.influencer_id = this.data.influencerId;
      }

      const response = await apiService.getSharingPosts(params);

      if (response.success) {
        const newPosts = response.data.posts || [];
        const pagination = response.data.pagination || {};

        this.setData({
          posts: this.data.page === 1 ? newPosts : [...this.data.posts, ...newPosts],
          hasMore: pagination && pagination.page && pagination.total_pages ? pagination.page < pagination.total_pages : false,
          loading: false,
        });
      } else {
        throw new Error(response.error?.message || '加载失败');
      }
    } catch (error) {
      console.error('Load sharing posts error:', error);
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none',
      });
      this.setData({ loading: false });
    }
  },

  async onLikePost(e) {
    const postId = e.currentTarget.dataset.postId;
    if (!postId) return;

    try {
      const response = await apiService.likeSharingPost(postId);

      if (response.success) {
        // Update likes count in local data
        const posts = this.data.posts.map((post) => {
          if (post.post_id === postId) {
            return {
              ...post,
              likes_count: response.data.likes_count,
            };
          }
          return post;
        });

        this.setData({ posts });

        wx.showToast({
          title: '点赞成功',
          icon: 'success',
        });
      } else {
        throw new Error(response.error?.message || '点赞失败');
      }
    } catch (error) {
      console.error('Like post error:', error);
      wx.showToast({
        title: error.message || '点赞失败',
        icon: 'none',
      });
    }
  },

  onPreviewImage(e) {
    const current = e.currentTarget.dataset.src;
    const urls = e.currentTarget.dataset.urls || [current];

    wx.previewImage({
      current,
      urls,
    });
  },
});
