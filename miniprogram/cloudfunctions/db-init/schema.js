// 数据库集合Schema定义
// 用于文档化和验证数据结构

/**
 * 1. users 用户集合
 */
const usersSchema = {
  _id: 'string',                    // 用户ID（自动生成）
  openid: 'string',                 // 微信openid（唯一）
  phone_number: 'string',           // 手机号
  role: 'string',                   // 角色：influencer(主播) / fan(粉丝)
  nickname: 'string',               // 昵称
  avatar_url: 'string',             // 头像URL
  
  // 主播专用字段
  id_card_number: 'string',         // 身份证号（用于物流实名制，仅主播填写）
  id_card_name: 'string',           // 身份证姓名
  
  // 发货地址列表（支持多个）
  shipping_addresses: [{
    address_id: 'string',           // 地址ID
    province: 'string',             // 省份
    city: 'string',                 // 城市
    district: 'string',             // 区县
    street: 'string',               // 详细地址
    contact_name: 'string',         // 联系人
    contact_phone: 'string',        // 联系电话
    is_default: 'boolean',          // 是否默认地址
    created_at: 'Date'              // 创建时间
  }],
  
  created_at: 'Date',               // 创建时间
  updated_at: 'Date'                // 更新时间
};

/**
 * 2. activities 赠送活动集合
 */
const activitiesSchema = {
  _id: 'string',                    // 活动ID
  influencer_id: 'string',          // 主播用户ID
  title: 'string',                  // 活动标题
  description: 'string',            // 活动描述
  
  // 活动基本信息
  live_platform: 'string',          // 开播平台（抖音/小红书/快手/视频号/B站）
  live_time: 'Date',                // 开播时间
  
  // 发货地址快照（活动创建时的地址，不随主播修改地址而改变）
  snapshot_shipping_address: {
    province: 'string',
    city: 'string',
    district: 'string',
    street: 'string',
    contact_name: 'string',
    contact_phone: 'string'
  },
  
  // 密码相关（单个活动独立）
  require_password: 'boolean',      // 是否需要密码
  access_password: 'string',        // 访问密码（如果启用）
  password_max_errors: 'number',    // 密码错误次数上限（默认5次）
  
  // 快递和数量限制
  designated_courier: 'string',     // 指定快递公司（如顺丰，为null则不指定）
  limit_quantity_per_item: 'number', // 单个物品限领数量（每人限2个）
  
  qr_code_url: 'string',            // 小程序码URL
  shareable_link: 'string',         // 分享链接
  status: 'string',                 // active / completed / cancelled
  total_items: 'number',            // 物品总数
  claimed_items: 'number',          // 已领取数量
  created_at: 'Date',               // 创建时间
  updated_at: 'Date'                // 更新时间
};

/**
 * 3. items 物品集合
 */
const itemsSchema = {
  _id: 'string',                    // 物品ID
  activity_id: 'string',            // 活动ID
  label: 'string',                  // 物品标签
  photo_urls: ['string'],           // 图片URL数组
  ai_category: 'string',            // AI识别类别
  ai_tags: ['string'],              // 标签数组
  estimated_weight: 'number',       // 估算重量（kg）
  
  // 5位数字编号（活动内自增，范围：00001-99999）
  item_number: 'string',            // 5位活动内自增数字编号
  marker_name: 'string',            // 标记名（主播可基于编号添加备注）
  
  // AI识别信息
  ai_weight: 'number',              // AI估算重量（kg），失败时为null
  use_default_price: 'boolean',     // 是否使用默认报价（AI失败时为true）
  
  quantity: 'number',               // 数量（最多99个）
  remaining_quantity: 'number',     // 剩余数量
  base_shipping_cost: 'number',     // 基础运费
  status: 'string',                 // available / claimed / shipped
  created_at: 'Date',               // 创建时间
  updated_at: 'Date'                // 更新时间
};

/**
 * 4. orders 订单集合
 */
const ordersSchema = {
  _id: 'string',                    // 订单ID
  activity_id: 'string',            // 活动ID
  
  // 统一使用order_items数组（包含1-N个物品）
  order_items: [{
    item_id: 'string',              // 物品ID
    item_number: 'string',          // 5位数字编号
    quantity: 'number',             // 该物品数量
    label: 'string',                // 物品名称
    photo_urls: ['string'],         // 图片URL
    category: 'string',             // 系统标签
    weight: 'number',               // 重量（kg）
    official_price: 'number'        // 该物品的官方报价（API查询）
  }],
  
  fan_wechat_openid: 'string',      // 粉丝openid
  fan_phone_number: 'string',       // 粉丝手机号
  
  // 收货地址
  shipping_address: {
    province: 'string',
    city: 'string',
    district: 'string',
    street: 'string'
  },
  shipping_contact_name: 'string',  // 收货人
  shipping_contact_phone: 'string', // 联系电话
  
  // 费用计算（官方报价模式）
  official_base_shipping: 'number', // 快递100官方报价（多物品取最高）
  packaging_fee: 'number',          // 包装费（物品数量*2元）
  service_fee: 'number',            // 平台服务费 = (官方报价+包装费)*5%
  total_amount: 'number',           // 粉丝支付总额
  
  // 平台成本（协议价）
  agreement_shipping_cost: 'number', // 协议价快递费
  actual_packaging_cost: 'number',  // 真实包装成本
  total_cost: 'number',             // 平台总成本
  platform_profit: 'number',        // 平台利润
  
  // 支付与状态
  payment_status: 'string',         // pending / paid / failed / refunded
  order_status: 'string',           // pending / processing / shipped / completed
  wechat_payment_transaction_id: 'string', // 微信支付交易号
  
  // 超时控制
  payment_deadline: 'Date',         // 支付截止时间（创建订单后15分钟）
  shipping_deadline: 'Date',        // 发货截止时间（支付后48小时）
  
  created_at: 'Date',               // 创建时间
  paid_at: 'Date',                  // 支付时间
  updated_at: 'Date'                // 更新时间
};

/**
 * 5. payments 支付记录集合
 */
const paymentsSchema = {
  _id: 'string',                    // 支付记录ID
  order_id: 'string',               // 订单ID
  fan_openid: 'string',             // 粉丝openid
  amount: 'number',                 // 支付金额
  payment_method: 'string',         // wechat_pay
  transaction_id: 'string',         // 微信交易号
  status: 'string',                 // pending / success / failed / refunded
  refund_reason: 'string',          // 退款原因
  refund_amount: 'number',          // 退款金额
  created_at: 'Date',               // 创建时间
  updated_at: 'Date'                // 更新时间
};

/**
 * 6. shipping_info 物流信息集合
 */
const shippingInfoSchema = {
  _id: 'string',                    // 物流信息ID
  order_id: 'string',               // 订单ID（唯一）
  tracking_number: 'string',        // 运单号
  courier_company: 'string',        // 快递公司
  courier_company_code: 'string',   // 快递公司代码
  
  // 发货信息
  sender_name: 'string',            // 发货人姓名
  sender_phone: 'string',           // 发货人电话
  sender_address: 'string',         // 发货地址
  
  // 收货信息
  receiver_name: 'string',          // 收货人姓名
  receiver_phone: 'string',         // 收货人电话
  receiver_address: 'string',       // 收货地址
  
  // 物流状态
  logistics_status: 'string',       // pending / picked_up / in_transit / delivered / signed / failed
  last_update_time: 'Date',         // 最后更新时间
  
  // 物流轨迹
  tracking_history: [{
    time: 'Date',                   // 时间
    status: 'string',               // 状态
    description: 'string'           // 描述
  }],
  
  // 电子面单
  waybill_image_url: 'string',      // 电子面单图片URL
  
  created_at: 'Date',               // 创建时间
  updated_at: 'Date'                // 更新时间
};

/**
 * 7. password_errors 密码错误记录集合
 */
const passwordErrorsSchema = {
  _id: 'string',                    // 记录ID
  activity_id: 'string',            // 活动ID
  user_openid: 'string',            // 用户openid
  error_count: 'number',            // 错误次数
  last_error_time: 'Date',          // 最后错误时间
  is_blocked: 'boolean',            // 是否被锁定
  created_at: 'Date',               // 创建时间
  updated_at: 'Date'                // 更新时间
};

/**
 * 8. sharing_posts 晒单集合
 */
const sharingPostsSchema = {
  _id: 'string',                    // 晒单ID
  order_id: 'string',               // 订单ID
  activity_id: 'string',            // 活动ID
  user_openid: 'string',            // 用户openid
  user_nickname: 'string',          // 用户昵称
  user_avatar_url: 'string',        // 用户头像
  
  content: 'string',                // 晒单文字内容
  image_urls: ['string'],           // 晒单图片（最多9张）
  
  likes_count: 'number',            // 点赞数
  is_deleted: 'boolean',            // 是否被删除（恶意内容）
  deleted_by: 'string',             // 删除者ID（主播）
  delete_reason: 'string',          // 删除原因
  
  created_at: 'Date',               // 创建时间
  updated_at: 'Date'                // 更新时间
};

/**
 * 9. external_activities 外部活动集合
 */
const externalActivitiesSchema = {
  _id: 'string',                    // 外部活动ID
  influencer_id: 'string',          // 主播用户ID
  platform: 'string',               // 平台（抖音/小红书等）
  activity_type: 'string',          // 活动类型
  activity_time: 'Date',            // 活动时间
  title: 'string',                  // 活动标题
  description: 'string',            // 活动描述
  cover_image_url: 'string',        // 封面图片
  external_link: 'string',          // 外部链接
  created_at: 'Date',               // 创建时间
  updated_at: 'Date'                // 更新时间
};

module.exports = {
  usersSchema,
  activitiesSchema,
  itemsSchema,
  ordersSchema,
  paymentsSchema,
  shippingInfoSchema,
  passwordErrorsSchema,
  sharingPostsSchema,
  externalActivitiesSchema
};
