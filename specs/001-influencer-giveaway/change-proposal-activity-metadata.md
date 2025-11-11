# Change Proposal: 活动元数据收集与批量上架优化

**提案编号**: CP-002  
**创建日期**: 2025-01-27  
**状态**: Draft  
**优先级**: High  
**影响范围**: 活动创建流程、物品上传流程、数据模型  

---

## 概述 (Overview)

### 当前问题 (Current State)

目前的活动创建流程过于简化，网红直接上传物品照片即可创建活动。这导致：

1. **活动信息不完整**：缺少活动基本信息（标题、描述、平台来源等）
2. **时间管理缺失**：没有活动开始时间的概念，无法提前准备或定时发布
3. **访问控制缺失**：所有活动都是公开的，无法实现私密活动或特定粉丝群体访问
4. **物流效率低**：没有优选快递设置，每个订单都需要重新选择快递公司
5. **上架效率低**：每个物品需要单独处理，无法批量上架相同/相似物品

### 提议改进 (Proposed Changes)

**两阶段活动创建流程**：

**阶段一：活动信息录入**（新增）
- 活动基本信息：标题、描述、封面图
- 发布平台与时间：来源平台、预计开始时间、是否立即发布
- 访问控制：是否需要密码、密码提示
- 物流配置：优选快递公司、发货地址

**阶段二：物品批量上架**（优化）
- 拍照上传物品
- 输入物品数量
- 批量生成物品记录（同一照片可生成多个相同物品）
- AI识别与标记

### 价值主张 (Value Proposition)

1. **更好的活动管理**：完整的活动信息便于网红管理和粉丝理解
2. **灵活的发布策略**：支持定时发布和提前预热
3. **隐私保护**：密码保护功能可实现VIP粉丝专享活动
4. **提升物流效率**：预设优选快递减少决策时间，提高发货速度
5. **批量操作**：大幅提高上架效率，特别是多件相同物品的场景

---

## 详细设计 (Detailed Design)

### 1. 新增数据字段

#### Activities 集合扩展

```javascript
{
  // 原有字段
  _id: String,
  influencer_id: String,
  status: String,
  share_link: String,
  qr_code_url: String,
  created_at: Date,
  updated_at: Date,
  published_at: Date,
  
  // 新增字段
  title: String,                    // 活动标题 (必填, 1-50字符)
  description: String,              // 活动描述 (选填, 0-500字符)
  cover_image_url: String,          // 活动封面图URL (选填)
  source_platform: String,          // 来源平台: 'douyin'|'xiaohongshu'|'wechat'|'other'
  scheduled_start_time: Date,       // 预计开始时间 (选填)
  is_immediate_publish: Boolean,    // 是否立即发布 (默认true)
  
  // 访问控制
  is_password_protected: Boolean,   // 是否需要密码 (默认false)
  access_password: String,          // 访问密码 (4-8位数字或字母)
  password_hint: String,            // 密码提示 (选填, 0-50字符)
  
  // 物流配置
  preferred_courier: String,        // 优选快递: 'shunfeng'|'yuantong'|'zhongtong'|'yunda'|null
  sender_address: Object,           // 发货地址 (JSON)
  sender_contact_name: String,      // 发货人姓名
  sender_contact_phone: String,     // 发货人电话
  
  // 统计信息
  total_items_count: Number,        // 总物品数量 (默认0)
  available_items_count: Number,    // 可用物品数量 (默认0)
  view_count: Number,               // 浏览次数 (默认0)
  access_attempts: Number           // 密码尝试次数 (默认0)
}
```

#### Items 集合扩展

```javascript
{
  // 原有字段
  _id: String,
  activity_id: String,
  photo_urls: Array<String>,
  ai_category: String,
  ai_tags: Array<String>,
  label: String,
  marker_name: String,
  marker_quantity: Number,
  marker_notes: String,
  shipping_cost_estimate: Number,
  status: String,
  qr_code_data: String,
  created_at: Date,
  updated_at: Date,
  
  // 新增字段
  batch_id: String,                 // 批次ID (同一批上传的物品共享)
  sequence_number: Number,          // 序号 (同批次内的序号, 1-N)
  original_quantity: Number,        // 原始上传时的数量
  is_batch_generated: Boolean       // 是否为批量生成 (默认false)
}
```

### 2. 用户流程设计

#### 2.1 活动信息录入页面

**页面路径**: `pages/create-activity-info/create-activity-info`

**表单字段**：

```
┌─────────────────────────────────────────┐
│  创建赠送活动                           │
├─────────────────────────────────────────┤
│                                         │
│  活动标题 *                             │
│  ┌───────────────────────────────────┐ │
│  │ 例如：春节清仓大放送              │ │
│  └───────────────────────────────────┘ │
│                                         │
│  活动描述                               │
│  ┌───────────────────────────────────┐ │
│  │ 简单介绍一下活动内容...           │ │
│  │                                   │ │
│  └───────────────────────────────────┘ │
│                                         │
│  活动封面（选填）                       │
│  ┌─────┐                               │
│  │ +   │  点击上传                      │
│  └─────┘                               │
│                                         │
│  来源平台 *                             │
│  ○ 抖音  ○ 小红书  ○ 微信  ○ 其他    │
│                                         │
│  开始时间                               │
│  □ 立即发布                            │
│  □ 定时发布  [选择时间]                │
│                                         │
│  访问控制                               │
│  □ 设置访问密码                        │
│     密码: ┌──────┐  提示: ┌─────────┐ │
│          │      │         │         │ │
│          └──────┘         └─────────┘ │
│                                         │
│  优选快递                               │
│  ○ 顺丰  ○ 圆通  ○ 中通  ○ 韵达      │
│  ○ 不指定                              │
│                                         │
│  发货地址 *                             │
│  ┌───────────────────────────────────┐ │
│  │ [选择地址]                        │ │
│  └───────────────────────────────────┘ │
│                                         │
│  发货人信息 *                           │
│  姓名: ┌────────┐  电话: ┌──────────┐│
│       │        │        │          ││
│       └────────┘        └──────────┘│
│                                         │
│         [取消]      [下一步：添加物品]  │
└─────────────────────────────────────────┘
```

**验证规则**：
- 活动标题：必填，1-50字符
- 活动描述：选填，最多500字符
- 来源平台：必选
- 访问密码：如启用，4-8位字符
- 发货地址：必填
- 发货人信息：必填，电话需符合手机号格式

#### 2.2 批量上架物品页面

**页面路径**: `pages/batch-upload-items/batch-upload-items`

**操作流程**：

```
┌─────────────────────────────────────────┐
│  添加物品                               │
│  活动：春节清仓大放送                   │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  拍照或选择照片                   │ │
│  │  ┌─────┬─────┬─────┬─────┐       │ │
│  │  │照片1│照片2│照片3│ +   │       │ │
│  │  └─────┴─────┴─────┴─────┘       │ │
│  └───────────────────────────────────┘ │
│                                         │
│  已添加物品列表：                       │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ 🖼 [照片]  Nike运动鞋              │ │
│  │    数量: [3] 件  AI识别: 鞋类     │ │
│  │    [编辑] [删除]                  │ │
│  ├───────────────────────────────────┤ │
│  │ 🖼 [照片]  iPhone手机壳            │ │
│  │    数量: [5] 件  AI识别: 配件     │ │
│  │    [编辑] [删除]                  │ │
│  └───────────────────────────────────┘ │
│                                         │
│  批量设置：                             │
│  物品标记前缀: ┌────────┐              │
│               │ITEM_   │              │
│               └────────┘              │
│                                         │
│         [返回]      [完成并发布活动]    │
└─────────────────────────────────────────┘
```

**批量生成逻辑**：
1. 用户为每张照片输入数量（默认1）
2. 系统为每张照片生成一个batch_id
3. 根据数量生成对应数量的item记录
4. 每个item有独立的sequence_number (1, 2, 3...)
5. 所有item共享同一组photo_urls和AI识别结果
6. 自动生成marker_name: `{prefix}_{batch_id}_{sequence}`

### 3. 云函数修改

#### 3.1 activities 云函数新增 action

**createWithMetadata** (创建活动含元数据)

```javascript
async function createWithMetadata(openid, data) {
  const {
    title,
    description,
    cover_image_url,
    source_platform,
    scheduled_start_time,
    is_immediate_publish,
    is_password_protected,
    access_password,
    password_hint,
    preferred_courier,
    sender_address,
    sender_contact_name,
    sender_contact_phone
  } = data;

  // 验证必填字段
  if (!title || title.length < 1 || title.length > 50) {
    return {
      success: false,
      error: {
        code: 'INVALID_TITLE',
        message: 'Title must be 1-50 characters'
      }
    };
  }

  if (!source_platform || !['douyin', 'xiaohongshu', 'wechat', 'other'].includes(source_platform)) {
    return {
      success: false,
      error: {
        code: 'INVALID_PLATFORM',
        message: 'Invalid source platform'
      }
    };
  }

  if (!sender_address || !sender_contact_name || !sender_contact_phone) {
    return {
      success: false,
      error: {
        code: 'MISSING_SENDER_INFO',
        message: 'Sender information is required'
      }
    };
  }

  // 验证密码
  if (is_password_protected) {
    if (!access_password || !/^[A-Za-z0-9]{4,8}$/.test(access_password)) {
      return {
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Password must be 4-8 alphanumeric characters'
        }
      };
    }
  }

  // 创建活动
  const result = await db.collection('activities').add({
    data: {
      influencer_id: openid,
      title,
      description: description || '',
      cover_image_url: cover_image_url || null,
      source_platform,
      scheduled_start_time: scheduled_start_time || null,
      is_immediate_publish: is_immediate_publish !== false,
      is_password_protected: is_password_protected || false,
      access_password: is_password_protected ? access_password : null,
      password_hint: password_hint || null,
      preferred_courier: preferred_courier || null,
      sender_address: JSON.stringify(sender_address),
      sender_contact_name,
      sender_contact_phone,
      total_items_count: 0,
      available_items_count: 0,
      view_count: 0,
      access_attempts: 0,
      status: is_immediate_publish ? 'draft' : 'scheduled',
      created_at: db.serverDate(),
      updated_at: db.serverDate()
    }
  });

  return {
    success: true,
    data: {
      activity_id: result._id,
      status: is_immediate_publish ? 'draft' : 'scheduled'
    }
  };
}
```

**verifyPassword** (验证访问密码)

```javascript
async function verifyPassword(data) {
  const { activity_id, password } = data;

  const activity = await db.collection('activities')
    .doc(activity_id)
    .get();

  if (!activity.data) {
    return {
      success: false,
      error: {
        code: 'ACTIVITY_NOT_FOUND',
        message: 'Activity not found'
      }
    };
  }

  if (!activity.data.is_password_protected) {
    return {
      success: true,
      data: { access_granted: true }
    };
  }

  // 记录尝试次数
  await db.collection('activities')
    .doc(activity_id)
    .update({
      data: {
        access_attempts: db.command.inc(1)
      }
    });

  if (activity.data.access_password === password) {
    return {
      success: true,
      data: { 
        access_granted: true,
        activity: activity.data
      }
    };
  }

  return {
    success: false,
    error: {
      code: 'INCORRECT_PASSWORD',
      message: 'Incorrect password',
      hint: activity.data.password_hint
    }
  };
}
```

#### 3.2 items 云函数新增 action

**batchUpload** (批量上传物品)

```javascript
async function batchUpload(openid, data) {
  const { activity_id, items_data, marker_prefix } = data;

  // 验证活动所有权
  const activity = await db.collection('activities')
    .doc(activity_id)
    .get();

  if (!activity.data || activity.data.influencer_id !== openid) {
    return {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: 'Permission denied'
      }
    };
  }

  const batch_id = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const created_items = [];

  // 遍历每个物品数据（每张照片）
  for (let i = 0; i < items_data.length; i++) {
    const item_data = items_data[i];
    const { photo_urls, quantity, ai_category, ai_tags } = item_data;

    // 为每个数量生成独立的item记录
    for (let seq = 1; seq <= quantity; seq++) {
      const marker_name = `${marker_prefix || 'ITEM'}_${batch_id}_${i + 1}_${seq}`;

      const result = await db.collection('items').add({
        data: {
          activity_id,
          photo_urls,
          ai_category: ai_category || 'uncategorized',
          ai_tags: ai_tags || [],
          label: '',
          marker_name,
          marker_quantity: 1,
          marker_notes: '',
          batch_id,
          sequence_number: seq,
          original_quantity: quantity,
          is_batch_generated: quantity > 1,
          status: 'available',
          qr_code_data: `marker_${activity_id}_${marker_name}`,
          created_at: db.serverDate(),
          updated_at: db.serverDate()
        }
      });

      created_items.push({
        item_id: result._id,
        marker_name,
        sequence: seq
      });
    }
  }

  // 更新活动的物品统计
  await db.collection('activities')
    .doc(activity_id)
    .update({
      data: {
        total_items_count: db.command.inc(created_items.length),
        available_items_count: db.command.inc(created_items.length),
        updated_at: db.serverDate()
      }
    });

  return {
    success: true,
    data: {
      batch_id,
      created_count: created_items.length,
      items: created_items
    }
  };
}
```

### 4. 页面路由调整

原流程：
```
pages/create-giveaway → pages/giveaway (发布完成)
```

新流程：
```
pages/create-activity-info (活动信息) 
  → pages/batch-upload-items (批量上传物品)
    → pages/activity-preview (预览)
      → pages/giveaway (发布完成)
```

### 5. 数据库索引优化

```javascript
// activities 集合索引
{
  "influencer_id": 1,
  "status": 1,
  "scheduled_start_time": 1
}

{
  "is_password_protected": 1,
  "status": 1
}

// items 集合索引
{
  "activity_id": 1,
  "batch_id": 1,
  "sequence_number": 1
}

{
  "batch_id": 1,
  "status": 1
}
```

---

## 用户故事更新 (Updated User Stories)

### 修订后的 User Story 1

**Given** an influencer has completed registration,  
**When** they create a new giveaway activity,  
**Then** they are guided through a two-step process:

**Step 1 - Activity Information**:
1. Enter activity title and description
2. Select source platform (Douyin/Xiaohongshu/WeChat/Other)
3. Choose publish strategy (immediate or scheduled)
4. Optionally set access password for exclusive access
5. Select preferred courier and provide sender information

**Step 2 - Batch Item Upload**:
1. Upload photos of items
2. Input quantity for each photo (system generates multiple items)
3. Review AI-identified categories
4. System generates unique markers for each item
5. Publish activity with all items

**Acceptance Criteria**:
- Activity contains complete metadata before items are added
- System supports batch generation of identical items from single photo
- Each item has unique marker even if from same photo
- Preferred courier is pre-selected for all orders from this activity
- Password-protected activities require password to view

---

## 边缘案例 (Edge Cases)

### 新增边缘案例

1. **定时发布未到时间访问**
   - 用户尝试在scheduled_start_time之前访问
   - 处理：显示"活动尚未开始"，展示倒计时

2. **密码多次错误**
   - 用户连续输入错误密码超过5次
   - 处理：临时锁定10分钟，通知网红

3. **批量上传数量过大**
   - 单次上传物品总数超过100件
   - 处理：拆分为多个批次，分批处理

4. **相同batch_id的物品被部分领取**
   - 同一批次5件物品中有3件被领取
   - 处理：正常，每个item独立状态，不影响其他

5. **活动创建后修改优选快递**
   - 网红在活动发布后修改preferred_courier
   - 处理：仅影响新订单，已存在订单保持原快递

---

## 成功指标 (Success Metrics)

### 新增指标

- **SM-001**: 活动信息完整度 ≥ 90% (包含标题、平台、发货信息)
- **SM-002**: 定时发布功能使用率 ≥ 30%
- **SM-003**: 密码保护活动占比 ≥ 15%
- **SM-004**: 批量上架效率提升：平均每个物品上架时间从30秒降至10秒
- **SM-005**: 优选快递命中率 ≥ 80% (订单使用活动预设快递的比例)
- **SM-006**: 批量生成功能使用率 ≥ 60% (使用数量>1的上传比例)

### 修订指标

- **SC-001 修订**: 网红创建包含5件物品的完整活动（含元数据）时间从3分钟优化至4分钟
  - 理由：增加活动信息录入步骤，但批量上架提高物品处理效率

---

## 迁移计划 (Migration Plan)

### 阶段一：数据库扩展（第1周）

1. 在 `activities` 集合添加新字段（设置默认值）
2. 在 `items` 集合添加批量相关字段
3. 创建必要的数据库索引
4. 运行迁移脚本为现有数据填充默认值

```javascript
// 迁移脚本示例
const migrateActivities = async () => {
  const activities = await db.collection('activities').get();
  
  for (const activity of activities.data) {
    await db.collection('activities').doc(activity._id).update({
      data: {
        title: activity.title || '赠送活动',
        source_platform: 'other',
        is_immediate_publish: true,
        is_password_protected: false,
        total_items_count: 0, // 需要重新计算
        available_items_count: 0,
        view_count: 0,
        access_attempts: 0
      }
    });
  }
};
```

### 阶段二：云函数开发（第2周）

1. 实现 `activities.createWithMetadata`
2. 实现 `activities.verifyPassword`
3. 实现 `items.batchUpload`
4. 更新现有云函数以兼容新字段
5. 编写单元测试

### 阶段三：前端开发（第3-4周）

1. 开发 `create-activity-info` 页面
2. 改造 `batch-upload-items` 页面
3. 开发 `activity-preview` 页面
4. 实现密码验证弹窗组件
5. 更新路由配置

### 阶段四：测试与发布（第5周）

1. 集成测试
2. 用户体验测试
3. 灰度发布（10%用户）
4. 收集反馈并优化
5. 全量发布

---

## 兼容性考虑 (Compatibility)

### 向后兼容

1. **现有活动**：自动填充默认值，正常展示和运行
2. **API版本**：保留旧版 `activities.create` 接口，标记为 deprecated
3. **前端适配**：检测活动是否包含新字段，展示对应UI

### 渐进增强

1. 新创建的活动强制使用新流程
2. 旧活动支持"升级"，补充元数据
3. 新功能（密码保护、定时发布）仅对新活动开放

---

## 风险评估 (Risk Assessment)

### 技术风险

| 风险项 | 影响 | 概率 | 缓解措施 |
|--------|------|------|----------|
| 批量生成物品性能问题 | 高 | 中 | 限制单次最大100件，分批处理 |
| 数据库迁移失败 | 高 | 低 | 提前备份，编写回滚脚本 |
| 云函数超时（批量操作） | 中 | 中 | 异步处理，返回task_id轮询结果 |

### 产品风险

| 风险项 | 影响 | 概率 | 缓解措施 |
|--------|------|------|----------|
| 流程复杂度增加导致用户流失 | 中 | 中 | 提供引导动画，允许跳过非必填项 |
| 密码保护降低活动曝光 | 低 | 高 | 统计数据分析，提供使用建议 |
| 定时发布功能被滥用 | 低 | 低 | 限制单个网红待发布活动数量 |

---

## 待解决问题 (Open Questions)

1. **Q**: 批量上架时，如果某些物品AI识别失败，是否阻断整个流程？  
   **A**: 不阻断，允许手动选择分类后继续

2. **Q**: 密码保护的活动是否计入公开活动列表？  
   **A**: 不计入，仅通过直接链接访问

3. **Q**: 定时发布到达时间后，是否自动转为active状态？  
   **A**: 是，使用云函数定时触发器

4. **Q**: 优选快递是否允许粉丝修改？  
   **A**: 第一版不允许，后续可考虑加价更换

5. **Q**: 批量生成的物品是否支持单独编辑？  
   **A**: 支持，每个item独立可编辑

---

## 附录 (Appendix)

### A. 相关文档

- [原始需求规格: spec.md](./spec.md)
- [数据模型: data-model.md](./data-model.md)
- [API契约: contracts/api-contracts.md](./contracts/api-contracts.md)

### B. 原型设计

（需补充原型图链接或附件）

### C. 技术参考

- 微信云开发文档: https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html
- 云数据库事务: https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/database/transaction.html

---

## 审批记录 (Approval)

| 角色 | 姓名 | 日期 | 状态 | 备注 |
|------|------|------|------|------|
| 产品经理 | - | - | Pending | - |
| 技术负责人 | - | - | Pending | - |
| UI/UX设计师 | - | - | Pending | - |

---

**下一步行动**:
1. 评审本提案
2. 收集相关方反馈
3. 细化技术实现方案
4. 创建开发任务并排期
