// components/loading/loading.js
Component({
  properties: {
    loading: {
      type: Boolean,
      value: false,
    },
    message: {
      type: String,
      value: '加载中...',
    },
    fullscreen: {
      type: Boolean,
      value: false,
    },
  },
});

