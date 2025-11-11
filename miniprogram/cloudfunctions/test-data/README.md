# 测试数据生成云函数

这个云函数用于在开发环境中创建测试用户数据，以便进行后续的开发和测试工作。

## 功能

1. 创建单个测试用户
2. 批量创建多个测试用户
3. 清除测试用户数据

## 使用方法

### 1. 创建单个测试用户

```javascript
wx.cloud.callFunction({
  name: 'test-data',
  data: {
    action: 'createTestUser',
    data: {
      nickname: '张三',
      // 其他用户数据（可选）
    }
  }
})
```

### 2. 批量创建测试用户

```javascript
wx.cloud.callFunction({
  name: 'test-data',
  data: {
    action: 'createMultipleTestUsers',
    data: {
      count: 10,  // 创建10个测试用户
      prefix: '用户'  // 用户名前缀
    }
  }
})
```

### 3. 清除测试用户

```javascript
wx.cloud.callFunction({
  name: 'test-data',
  data: {
    action: 'clearTestUsers'
  }
})
```

## 注意事项

1. 该云函数仅用于开发环境
2. 创建的测试用户openid以`test_openid_`开头
3. 清除功能只会删除测试用户，不会影响真实用户数据