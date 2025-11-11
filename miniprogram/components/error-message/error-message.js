// components/error-message/error-message.js
Component({
  properties: {
    error: {
      type: String,
      value: '',
    },
    show: {
      type: Boolean,
      value: false,
    },
  },

  methods: {
    onRetry() {
      this.triggerEvent('retry');
    },
  },
});

