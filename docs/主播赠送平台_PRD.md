# 🎁 微信小程序 - 主播闲置赠送平台 PRD（修正版）

# 不要删除，后期我会自己清理
# 百度key
APIKey=Ynk0D3FhSZO5UVxcLrMMO60R
SecretKey=bTHzNmCKAVE8dKSFGH2HNHg3A4sHCEMA
# WeChat Mini Program Configuration
WECHAT_APPID=wx28fe6d19a46e6327
WECHAT_SECRET=789b87feaa1bc64f42489529d64b04d6
# 快递API配置
# 方案1：快递100 API（推荐用于测试和开发）
KUAIDI100_KEY=EZWROLVn8912
KUAIDI100_SECRET=b18729a888c54001b9d9f9a7aa6cbce7

# 方案2：聚合数据API（备选）
JUHE_APP_KEY=你的聚合数据AppKey

# 方案3：快递鸟（付费方案）
KDN_EBUSINESS_ID=1901915
KDN_API_KEY=633e5647-b75c-4143-a874-1e0f76627ba0

# 方案4：开发测试用Mock数据（本地测试）
USE_MOCK_EXPRESS=false


## 一、产品概述

### 1.1 产品定位  
这是一个帮助抖音、小红书等主播**快速清理闲置物品并与粉丝互动**的微信小程序。  
主播只需注册并拍照上传物品，系统通过 AI 自动识别物品类型、计算运费、生成赠送页面，粉丝支付包装与运费即可领取。

平台负责物流结算与运费差价收益，主播**无需定价、无需发货对接、无需客服沟通**。

### 1.2 技术架构

**前端**：
- 微信小程序（原生开发）
- 云开发能力（云存储、云数据库、云函数）

**后端**：
- **腾讯云函数**（Serverless 架构）
  - 用户认证云函数（auth）
  - 订单管理云函数（orders）
  - 支付处理云函数（payments）
  - 物品管理云函数（items）
  - 活动管理云函数（activities）
  - 物流对接云函数（shipping）
  - AI识别云函数（ai-recognition）
  - 数据统计云函数（analytics）

**数据存储**：
- **腾讯云数据库（MongoDB 兼容）**
  - 云开发数据库（支持文档型存储）
  - 主要集合：users、activities、items、orders、payments、shipping_info
  - 支持实时数据同步

**第三方服务**：
- **百度 AI 图像识别**（物品识别、类型分类）
- 快递 API（顺丰、菜鸟等）
- 微信支付（小程序支付）

---

## 二、产品核心流程

### 2.1 主播端（最小操作）

1. **注册/登录**
   - 微信授权 → 直接获取微信用户信息（无需平台审核）
   - 绑定手机号
   - **填写身份证信息**（用于物流实名制）
   - 填写默认发货地址（**支持多个地址**，可设置默认地址）

2. **发起赠送活动**
   - 点击「发起赠送」
   - **填写活动基本信息**：
     - 开播平台（抖音/小红书/快手/视频号等）
     - 开播时间（选择具体日期和时间）
     - 是否需要密码（设置访问密码，**单个活动独立**，可修改）
       - 粉丝在**进入活动页**时输入密码
       - 密码错误次数限制：**5次**
     - 是否指定快递（指定特定快递公司，费用随指定快递增加而增加）
     - 是否限制单个物品领取数量（**每人限领2个**）
   - **批量拍摄/上传闲置物照片**（支持一次选多张）  
   - 系统自动执行：
     - 🧠 AI 自动识别物品类型并映射到系统8个标签（失败时需主播手动选择）
     - AI自动估算重量（失败时使用基础报价+2元）
     - 自动生成简短标题
     - **自动生成5位数字编号**（活动内自增，如「00001」，支持主播修改但需活动内唯一）
     - **不调用快递API**，使用预设运费模板展示预估价格
     - 系统显示**预估费用**（基于预设模板，非真实API查询）

3. **主播标记赠品**
   - 系统为每个上传的物品自动生成：
     - **5位数字编号**（自增序列，范围：00000-99999）
     - 主播可修改编号（但必须在同一活动内唯一）
     - 主播可基于编号添加备注（例如「00001-红色衣服」）
     - 数量设置（**单个物品最多99个**）
     - 特殊说明（可选）
   - **库存提示**：库存不足时显示“仅剩N个”
   - **不支持**：中途增加库存、预约领取
   - 用于后续订单自动匹配与发货清单生成。

4. **发布活动**
   - 点击「确认发布」即可生成：
     - 活动页链接
     - 小程序码（主播可放入抖音直播间或简介）

5. **系统自动执行**
   - 自动创建赠品清单
   - 自动扣减库存
   - 粉丝支付成功后，调用快递API自动下单
   - 自动生成发货单与物流单号（支付后触发）

> ✅ 主播全程只需「拍照 → 标记 → 发布」，运费计算、物流、匹配、发货全自动。

---

### 2.2 粉丝端（领取流程）

1. 扫码或输入主播编号进入主播赠送主页
2. **如有密码保护**：在进入活动页时输入密码（错误5次后需等待或联系主播）
3. 查看当前赠送活动
4. 选择物品（**同一活动可选多个不同物品**，每个物品每人限领2个）
5. 支付运费+包装费+服务费（系统显示官方报价，**15分钟内完成支付**）
   - **超时15分钟**：订单自动取消并释放库存
   - **不支持用户主动取消订单**（支付后无法手动取消）
   - **系统自动取消**：支付超时时系统自动取消并释放库存
6. 系统生成订单并推送物流状态
7. 粉丝可查看：
   - 赠品状态（待发货/运输中/已完成）
   - 晒单区留言（无需审核，恶意内容可删除）
   - 主播历史赠送记录与外部活动时间线（非本平台的线上直播活动）

**粉丝权限**：
- 同一活动内：可领取多个不同物品
- 不同活动间：领取次数不限制
- 无需防刷机制
- 无黑名单功能

---

## 三、系统模块设计（修正版）

### 3.1 主播模块

| 功能模块 | 说明 |
|-----------|------|
| 主播注册 | 微信授权登录，填写发货地址，绑定手机号 |
| 批量上传赠品 | 批量拍照或相册导入，系统自动识别并生成清单 |
| AI 智能识别 | 自动识别物品类型、生成标签与标题 |
| 赠品标记 | 主播可手动命名物品标识（用于快速发货匹配） |
| 发布活动 | 系统计算运费与服务费，自动生成赠送主页与二维码 |
| 活动列表 | 查看当前/历史活动（包含库存与领取数） |
| 订单中心 | 查看订单状态与物流信息 |
| 数据统计 | 系统汇总总赠送量、活动次数、累计粉丝数 |

---

### 3.2 粉丝模块

| 功能模块 | 说明 |
|-----------|------|
| 主播主页 | 展示主播信息、赠送活动、历史记录 |
| 当前活动 | 展示赠品卡片（含AI识别标签与运费） |
| 领取流程 | 选择赠品 → 支付 → 生成订单 |
| 我的订单 | 查看订单状态与物流 |
| 晒单区 | 上传收货照片、增加互动 |
| 活动记录 | 查看主播外部活动（含时间线展示） |

---

### 3.3 平台自动化模块

**完整流程图**：
```
主播上传物品 → AI识别重量/类型 → 系统调用快递API预估运费
       ↓
粉丝下单支付 → 系统自动生成总价（运费成本+包装+差价）
       ↓
系统自动下单 → 快递面单生成 → 发货 → 物流同步
```

#### ① 运费计算模块（核心差价逻辑）

**1. 第三方快递 API 对接策略**

**推荐方案**：使用**快递鸟API**或**快递100 API**作为统一的快递聚合服务

**为什么选择快递聚合服务？**
- ✅ **一个接口对接多家快递**：快递鸟支持400+家快递公司（顺丰、圆通、申通、中通、韵达、京东、EMS等）
- ✅ **降低对接成本**：避免逐个对接每家快递公司的API
- ✅ **统一数据格式**：返回标准化的JSON格式，便于处理
- ✅ **自动识别快递公司**：根据单号自动识别快递公司
- ✅ **功能完善**：支持运费查询、下单、物流跟踪、电子面单等

**可选服务商对比**：

| 服务商 | 支持快递数量 | 免费额度 | 价格 | 推荐指数 |
|--------|-------------|---------|------|----------|
| **快递鸟** | 400+ | 3000次/天（查询） | ¥0.01-0.03/次 | ⭐⭐⭐⭐⭐ |
| **快递100** | 500+ | 500次/天（查询） | ¥0.02-0.05/次 | ⭐⭐⭐⭐ |
| **顺丰开放平台** | 仅顺丰 | 无免费额度 | 按协议价 | ⭐⭐⭐ |
| **菜鸟API** | 多家（需企业认证） | 按协议 | 按协议 | ⭐⭐⭐ |

**推荐方案对比**：

| 方案 | 免费额度 | 价格 | 获取难度 | 推荐场景 |
|------|---------|------|----------|----------|
| **快递100 API**⭐ | 无限制 | 实时扣费 | ★★ | **主要方案（V1.0使用）** |
| **Mock数据** | 无限 | 免费 | ★ | 本地测试 |
| **聚合数据API** | 100次 | ¥0.01/次 | ★★ | 备选方案 |
| **快递鸟** | 无免费 | ¥1400/年起 | ★★★ | 未来扩展 |

**V1.0明确使用：快递100 API**
- **查询运费接口**：`method=price`（获取官方报价）
- **下单接口**：`method=order`（生成运单号）
- **协议价格**：平台与快递公司的协议价（低于官方报价）
- **利润来源**：官方报价 - 协议价 = 平台利润

**快递100 API 技术详情**：

**接口地址**：`https://api.kuaidi100.com/label/order`

**请求方式**：HTTP POST 或 GET

**必需参数**：

| 参数名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| method | string | 业务类型 | "price" |
| key | string | 授权码 | "EZWROLVn8912" |
| sign | string | MD5签名（32位大写） | 动态生成 |
| t | string | 时间戳 | "1576123932000" |
| param | json | 查询参数 | 详见param结构 |

**param 数据结构**：
```json
{
  "kuaidicom": "shunfeng",  // 快递公司编码
  "sendAddr": "深圳南山区",   // 寄件地址
  "recAddr": "北京海淀区",    // 收件地址
  "weight": "12"            // 重量（kg）
}
```

**签名算法**：
```javascript
// sign = MD5(param + t + key + secret).toUpperCase()
const signStr = paramJson + timestamp + key + secret;
const sign = crypto.createHash('md5').update(signStr, 'utf8').digest('hex').toUpperCase();
```

**返回数据结构**：
```json
{
  "success": true,
  "code": 200,
  "message": "success",
  "data": {
    "kuaidicom": "jd",
    "combos": [
      {
        "price": 83.0,          // 预估运费（元）
        "productName": "京东标快"  // 产品类型
      }
    ]
  }
}
```

**错误码说明**：

| 错误码 | 说明 | 处理方式 |
|--------|------|----------|
| 200 | 提交成功 | 正常处理 |
| -1 | 服务器错误 | 重试或联系客服 |
| 30001 | 参数错误 | 检查请求参数 |
| 30002 | 签名失败 | 检查加密方式 |
| 30004 | 余额不足 | 需要充值 |
| 30005 | 该地未开通 | 更换快递公司 |

**支持的快递公司**：

| 快递名称 | 编码 |
|---------|--------|
| 顺丰 | shunfeng |
| 京东 | jd |
| 德邦快递 | debangkuaidi |
| 圆通 | yuantong |
| 中通 | zhongtong |
| 申通 | shentong |
| 韵达 | yunda |
| EMS | ems |
| 跨越 | kuayue |

**开发测试方案：Mock数据**
- 完全免费，无需注册
- 适合本地功能开发
- 可模拟各种快递状态

**正式商用方案：快递鸟**
- 官网：https://www.kdniao.com
- 需要付费：¥1400/年起
- 适合大规模商用项目

- **API 对接模式**：
  - **统一接口封装**：统一下单、运费查询、物流跟踪接口，支持多快递公司切换
  - **运费预估**：结合 AI 估算赠品重量，调用快递 API 获取费用
  - **自动下单与面单生成**：电子面单自动生成，可绑定快递员或仓库

**云函数实现方案（快递100 API）**：

在腾讯云函数中对接快递100 API，封装以下云函数：

1. **运费查询云函数** (`express-query-price`)
   - 输入：起始地、目的地、重量、快递公司
   - 输出：真实快递费用
   - 调用：快递100 API的运费查询接口
   - **授权Key**：EZWROLVn8912

2. **快递下单云函数** (`express-create-order`)
   - 输入：订单信息、发件人、收件人、物品信息
   - 输出：运单号、电子面单URL
   - 调用：快递100 API的下单接口

3. **物流跟踪云函数** (`express-track`)
   - 输入：运单号
   - 输出：物流轨迹、当前状态
   - 调用：快递100 API的物流查询接口

**对接流程（快递100）**：

```
步骤1：已完成注册并获取API凭证 ✅
       - 授权Key: EZWROLVn8912
       - Secret: b18729a888c54001b9d9f9a7aa6cbce7
步骤2：在腾讯云函数中配置环境变量：
       - KUAIDI100_KEY = "EZWROLVn8912"
       - KUAIDI100_SECRET = "b18729a888c54001b9d9f9a7aa6cbce7"
步骤3：在云函数中安装 axios 或 request 库
步骤4：调用快递100 API，处理返回结果
```

**示例代码（云函数 - 快递100）**：

```javascript
// 云函数：express-query-price
const crypto = require('crypto');
const axios = require('axios');

exports.main = async (event) => {
  const { from_province, to_province, weight, courier = '顺丰' } = event;
  
  // 快递100 API配置
  const KEY = process.env.KUAIDI100_KEY || 'EZWROLVn8912';
  const SECRET = process.env.KUAIDI100_SECRET || 'b18729a888c54001b9d9f9a7aa6cbce7';
  const API_URL = 'https://api.kuaidi100.com/label/order';
  
  // 构建请求参数
  const param = {
    kuaidicom: getCourierCode(courier),  // 快递公司编码
    sendAddr: from_province,             // 寄件地址
    recAddr: to_province,                // 收件地址
    weight: weight.toString()            // 重量（kg）
  };
  
  const paramStr = JSON.stringify(param);
  const timestamp = Date.now().toString();
  
  // 生成签名：MD5(param + t + key + secret)
  const signStr = paramStr + timestamp + KEY + SECRET;
  const sign = crypto.createHash('md5').update(signStr, 'utf8').digest('hex').toUpperCase();
  
  // 调用快递100 API
  try {
    const response = await axios.post(API_URL, null, {
      params: {
        method: 'price',
        key: KEY,
        sign: sign,
        t: timestamp,
        param: paramStr
      }
    });
    
    const result = response.data;
    
    if (result.success && result.code === 200) {
      // 提取第一个价格方案
      const price = result.data.combos && result.data.combos.length > 0 
        ? result.data.combos[0].price 
        : 8.0;
      
      return {
        success: true,
        shipping_cost: price,  // 真实快递费用
        courier: courier,
        productName: result.data.combos[0]?.productName || ''
      };
    } else {
      return {
        success: false,
        error: result.message,
        code: result.code
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// 快递公司编码映射（快递100编码）
function getCourierCode(courierName) {
  const courierMap = {
    '顺丰': 'shunfeng',
    '圆通': 'yuantong',
    '申通': 'shentong',
    '中通': 'zhongtong',
    '韵达': 'yunda',
    '京东': 'jd',
    'EMS': 'ems',
    '德邦': 'debangkuaidi',
    '跨越': 'kuayue'
  };
  return courierMap[courierName] || 'shunfeng';
}
```

**关键点说明**：
1. ✅ 签名顺序：`param + t + key + secret`（按此顺序拼接）
2. ✅ 签名格式：MD5加密后转32位大写
3. ✅ 重量单位：kg，传字符串类型
4. ✅ 返回价格：`data.combos[0].price`（单位：元）

**优势**：
- ✅ **Serverless架构**：按需计费，无需维护服务器
- ✅ **自动扩容**：支持高并发访问
- ✅ **安全隔离**：API Key存储在环境变量，不暴露在小程序代码中
- ✅ **统一管理**：所有快递相关逻辑集中在云函数，便于维护

**2. 定价策略：官方报价 + 协议价差**

**核心逻辑**：粉丝支付的费用是**快递100官方报价**，平台实际使用**协议价**发货，两者差价即为平台利润。

**单物品订单计算公式**：
```
官方报价 = 调用快递100 API获取（展示给粉丝的价格）
包装费 = 2元/个
平台服务费 = (官方报价 + 包装费) * 5%
粉丝支付 = 官方报价 + 包装费 + 平台服务费

协议价 = 平台与快递公司的协议价格（低于官方报价，不展示）
真实包装成本 = 实际包装材料成本
平台成本 = 协议价 + 真实包装成本

平台利润 = 粉丝支付 - 平台成本
```

**多物品订单计算公式**：
```
步骤1：分别查询每个物品的官方报价
  - 物品1：调用API（地区 + 类型 + 重量） → 官方报价1
  - 物品2：调用API（地区 + 类型 + 重量） → 官方报价2
  - 物品N：调用API（地区 + 类型 + 重量） → 官方报价N

步骤2：取最高官方报价作为基础运费
  基础运费 = MAX(官方报价1, 官方报价2, ..., 官方报价N)

步骤3：计算总费用
  包装费 = 物品数量 * 2元
  平台服务费 = (基础运费 + 包装费) * 5%
  粉丝支付 = 基础运费 + 包装费 + 平台服务费

步骤4：计算平台成本（使用协议价）
  协议价 = 平台实际发货价格
  真实包装成本 = 实际材料成本
  平台成本 = 协议价 + 真实包装成本

步骤5：计算利润
  平台利润 = 粉丝支付 - 平台成本
```

**定价规则细节**：
  - **官方报价获取**：根据地区、物品类型、重量动态调用快递100 API
  - **包装费**：固定2元/个
  - **平台服务费**：(快递费 + 包装费) * 5%
  - **协议价**：平台与快递公司协商的实际发货价格（不对外展示）
  - **指定快递处理**：主播指定快递时，使用该快递公司的官方报价

**3. 报价生成维度**：
  - 商品类型（AI识别，失败则使用默认类型）
  - 估算重量（AI识别，失败则使用基础报价+2元）
  - 发货省份与收货省份
  - 快递公司选择（默认最优惠，主播可指定）

**4. 价格体系说明**：
  - **官方报价**：调用快递100 API获取，展示给粉丝
  - **协议价**：平台实际发货价格，后台记录
  - **粉丝支付**：官方报价 + 包装费 + 平台服务费(5%)
  - **平台利润**：粉丝支付 - 平台成本

💰 **利润计算**：
```
平台利润 = (官方报价 + 包装费 + 服务费) - (协议价 + 真实包装成本)
```

**关键说明**：
- 粉丝看到的价格是快递100官方报价（透明化）
- 平台通过协议价获得成本优势
- 平台服务费=（快递费+包装费）*5%，覆盖运营成本
- 多物品订单通过多次API调用找出最高报价作为基础运费

**示例**：

**示例1：单物品订单（衣服）**
| 项目 | 金额 | 说明 |
|------|------|------|
| 官方报价（API获取） | ¥12.0 | 快递100官方价格 |
| 包装费 | ¥2.0 | 固定2元/个 |
| 平台服务费 | ¥0.7 | (12+2)*5%=0.7 |
| **粉丝支付总额** | **¥14.7** | 展示给粉丝的价格 |
| 协议价（实际发货） | ¥8.0 | 平台协议价 |
| 真实包装成本 | ¥1.5 | 实际材料成本 |
| **平台成本** | **¥9.5** | 协议价+包装成本 |
| **平台利润** | **¥5.2** | 14.7-9.5 |

**示例2：多物品订单（衣服+鞋子）**
| 项目 | 金额 | 说明 |
|------|------|------|
| 官方报价-衣服 | ¥12.0 | API查询 |
| 官方报价-鞋子 | ¥15.0 | API查询 |
| 基础运费（取最高） | ¥15.0 | MAX(12, 15) |
| 包装费 | ¥4.0 | 2个*2元 |
| 平台服务费 | ¥0.95 | (15+4)*5%=0.95 |
| **粉丝支付总额** | **¥19.95** | 展示给粉丝的价格 |
| 协议价（实际发货） | ¥10.0 | 平台协议价 |
| 真实包装成本 | ¥3.0 | 2个物品材料成本 |
| **平台成本** | **¥13.0** | 协议价+包装成本 |
| **平台利润** | **¥6.95** | 19.95-13.0 |

**5. 功能优化与异常处理**：

| 功能 | 描述 |
| ------ | ---------------------- |
| 官方报价获取 | 调用快递100 API获取官方报价（展示给粉丝） |
| 协议价应用 | 平台实际使用协议价发货（低于官方报价） |
| 自动下单 | 粉丝支付成功后系统调用快递100 API自动下单 |
| 面单生成 | 自动生成电子面单 |
| 快递选择策略 | 默认最优惠快递，主播可指定快递（使用指定快递的官方报价） |
| 利润分析 | 后台显示每单利润（官方报价 - 协议价）与总利润 |
| 物流查询 | 每6小时查询一次，已签收订单不再查询 |
| 异常处理 | 快递延迟或退件自动提醒，维护主播体验 |

#### ② AI 识别与分类模块

**百度AI接口信息**：
- **API名称**：通用物体和场景识别（Advanced General）
- **接口地址**：`https://aip.baidubce.com/rest/2.0/image-classify/v2/advanced_general`
- **请求方式**：HTTP POST
- **鉴权方式**：access_token（通过API Key和Secret Key获取）

**请求参数**：

| 参数 | 是否必选 | 类型 | 说明 |
|------|---------|------|------|
| image | 和url二选一 | string | base64编码的图片数据，编码后不超过8M |
| url | 和image二选一 | string | 图片URL，不超过1024字节 |
| baike_num | 否 | integer | 返回百科信息的数量（可选） |

**返回结果结构**：
```json
{
  "log_id": 123456789,
  "result_num": 5,
  "result": [
    {
      "keyword": "沙发",      // 识别出的物体名称
      "score": 0.98,         // 置信度 0-1
      "root": "家居用品"     // 上层分类标签
    },
    {
      "keyword": "抱枕",
      "score": 0.85,
      "root": "家居-软装"
    }
  ]
}
```

**识别输出**：
  - **百度AI原始分类** → 自动映射到系统8个标签
  - **系统标签**：电子产品/服装/图书/化妆品/玩具/食品/家居/其他
  - 估算重量（供运费模块使用）
  - 推荐标题（如"女士连衣裙-粉色 M码"）
  - **自动生成5位数字编号**（活动内自增，范围：00001-99999）

**分类映射规则**：

| 百度AI关键词 | 系统标签 | 预设重量 |
|-------------|---------|----------|
| 手机、电脑、相机、耳机 | 电子产品 | 0.5kg |
| 衣服、裤子、鞋子、包包 | 服装 | 0.3kg |
| 书籍、杂志、文具 | 图书 | 0.4kg |
| 口红、香水、护肤品 | 化妆品 | 0.2kg |
| 玩具、娃娃、模型 | 玩具 | 0.3kg |
| 零食、饮料、食品 | 食品 | 0.5kg |
| 沙发、抱枕、家具、装饰品 | 家居 | 0.6kg |
| 其他未匹配的 | 其他 | 0.5kg |

**重量估算策略**：
  - AI识别成功：使用上述分类对应的预设重量
  - AI识别失败：使用基础报价+2元作为预设价格

**自动填充**：识别结果自动填充到赠品表单，主播可修改。

**AI失败兜底**：
  - 如果AI识别失败，主播手动选择系统8个标签之一
  - 重量使用默认值，运费使用基础报价+2元

**图片存储方案**：
- 存储在**腾讯云存储**（COS - Cloud Object Storage）
- 上传时自动转为base64调用百度AI接口
- 自动压缩和生成缩略图
- CDN加速分发

#### ③ 赠品标记与订单匹配模块
- **自动生成编号**：
  - 每个赠品在上传时系统自动生成**5位自增数字编号**（范围：00000-99999）
  - 主播可修改编号，但必须在**同一活动内保持唯一**
  - 主播可基于编号添加备注（如"00001-红色连衣裙"）
  - 便于主播记录和管理物品清单
- **订单匹配**：
  - 粉丝下单后，系统自动将订单与标记的赠品匹配
  - 若库存>1，按标记分配；若库存=1，标记即锁定
  - 支持「扫码配对发货」：主播扫描赠品二维码即可自动识别对应订单
- **多物品订单**：
  - 一个订单**至少包含1个物品**，**最多支持多个物品**
  - 粉丝可一次性选择多个物品
  - 系统分别查询每个物品的官方报价，取最高作为基础运费
  - 包装费 = 物品数量 * 2元
  - **不支持部分物品来自不同地址**的情况
  - 订单信息中包含 `order_items` 数组，记录所有物品详情

---

### 3.4 数据模型（云数据库版）

采用**腾讯云开发数据库**（MongoDB 兼容），支持灵活的文档型存储。

#### 主要数据集合

**1. users（用户集合）**
```javascript
{
  _id: "用户ID",
  openid: "微信openid",
  phone_number: "手机号",
  role: "influencer / fan",  // 角色
  nickname: "昵称",
  avatar_url: "头像URL",
  
  // 主播专用字段
  id_card_number: "身份证号（用于物流实名制，仅主播填写）",
  id_card_name: "身份证姓名",
  
  shipping_addresses: [  // 发货地址列表（支持多个）
    {
      address_id: "地址ID",
      province: "省份",
      city: "城市",
      district: "区县",
      street: "详细地址",
      contact_name: "联系人",
      contact_phone: "联系电话",
      is_default: true,  // 是否默认地址
      created_at: Date
    }
  ],
  created_at: Date,
  updated_at: Date
}
```

**2. activities（赠送活动集合）**
```javascript
{
  _id: "活动ID",
  influencer_id: "主播用户ID",
  title: "活动标题",
  description: "活动描述",
  
  // 活动基本信息
  live_platform: "开播平台（抖音/小红书/快手/视频号/B站）",
  live_time: Date,  // 开播时间
  
  // 发货地址快照（活动创建时的地址，不随主播修改地址而改变）
  snapshot_shipping_address: {
    province: "省份",
    city: "城市",
    district: "区县",
    street: "详细地址",
    contact_name: "联系人",
    contact_phone: "联系电话"
  },
  
  // 密码相关（单个活动独立）
  require_password: false,  // 是否需要密码
  access_password: "访问密码（如果启用，主播可修改）",
  password_max_errors: 5,  // 密码错误次数上限
  
  // 快递和数量限制
  designated_courier: "指定快递公司（如顺丰，为null则不指定）",
  limit_quantity_per_item: 2,  // 单个物品限领数量（每人领2个）
  
  qr_code_url: "小程序码URL",
  shareable_link: "分享链接",
  status: "active / completed / cancelled",
  total_items: 0,  // 物品总数
  claimed_items: 0,  // 已领取数量
  created_at: Date,
  updated_at: Date
}
```

**3. items（物品集合）**
```javascript
{
  _id: "物品ID",
  activity_id: "活动ID",
  label: "物品标签",
  photo_urls: ["图片URL数组"],
  ai_category: "AI识别类别",
  ai_tags: ["标签数组"],
  estimated_weight: 0.5,  // kg
  
  // 5位数字编号（活动内自增，范围：00001-99999）
  item_number: "00001",  // 5位活动内自增数字编号，主播可修改但必须在同一活动内唯一
  marker_name: "标记名（主播可基于编号添加备注）",
  
  // AI识别信息
  ai_weight: 0.5,  // AI估算重量（kg），失败时为null
  use_default_price: false,  // 是否使用默认报价（AI失败时为true）
  
  quantity: 1,  // 最多99个
  remaining_quantity: 1,
  base_shipping_cost: 10.0,  // 基础运费
  status: "available / claimed / shipped",
  created_at: Date,
  updated_at: Date
}
```

**4. orders（订单集合）**
```javascript
{
  _id: "订单ID",
  activity_id: "活动ID",
  
  // 统一使用order_items数组（包含1-N个物品）
  order_items: [  // 订单物品列表（至少1个，最多N个）
    {
      item_id: "物品ID",
      item_number: "00001",  // 5位数字编号
      quantity: 1,  // 该物品数量
      label: "物品名称",
      photo_urls: ["图片URL"],
      category: "服装",  // 系统标签
      weight: 0.5,  // 重量（kg）
      official_price: 12.0  // 该物品的官方报价（API查询）
    }
  ],
  
  fan_wechat_openid: "粉丝openid",
  fan_phone_number: "粉丝手机号",
  shipping_address: {  // 收货地址
    province: "省份",
    city: "城市",
    district: "区县",
    street: "详细地址"
  },
  shipping_contact_name: "收货人",
  shipping_contact_phone: "联系电话",
  
  // 费用计算（官方报价模式）
  official_base_shipping: 12.0,  // 快递100官方报价（多物品取最高）
  packaging_fee: 2.0,  // 包装费（物品数量*2元）
  service_fee: 0.7,  // 平台服务费 = (官方报价+包装费)*5%
  total_amount: 14.7,  // 粉丝支付总额 = 官方报价 + 包装费 + 服务费
  
  // 平台成本（协议价）
  agreement_shipping_cost: 8.0,  // 协议价快递费（实际发货价格）
  actual_packaging_cost: 1.5,  // 真实包装成本
  total_cost: 9.5,  // 平台总成本 = 协议价 + 真实包装成本
  
  // 平台利润 = 粉丝支付总额 - 平台总成本
  platform_profit: 5.2,
  
  // 支付与状态
  payment_status: "pending / paid / failed / refunded",
  order_status: "pending / processing / shipped / completed",
  wechat_payment_transaction_id: "微信支付交易号",
  
  // 支付超时控制（15分钟）
  payment_deadline: Date,  // 支付截止时间（创建订单后15分钟）
  
  // 发货时间要求（48小时内）
  shipping_deadline: Date,  // 发货截止时间（支付后48小时）
  
  created_at: Date,
  paid_at: Date,
  updated_at: Date
}
```

**订单业务规则**：
- **计费模式**：粉丝支付快递100官方报价+包装费+服务费(5%)，平台使用协议价发货
- **支付超时**：15分钟内未支付，订单系统自动取消并释放库存
- **取消订单规则**：
  - 支付前：超时自动取消
  - 支付后：**不支持用户主动取消**
  - 系统取消：支付超时时自动取消
- **退款规则**：
  - 支付后未发货：可申请退款，全额退款
  - 发货后：**不支持退款**
  - 多物品订单：**不支持部分退款**（只能全退）
- **发货时限**：主播须在48小时内发货，超时系统自动提醒
- **物流异常**：丢件/损坏由快递公司负责，平台不承担责任
- **签收确认**：直接读取快递100 API的物流信息，平台不需单独管理

**5. payments（支付记录集合）**
```javascript
{
  _id: "支付记录ID",
  order_id: "订单ID",
  fan_openid: "粉丝openid",
  amount: 12.6,
  payment_method: "wechat_pay",
  transaction_id: "微信交易号",
  status: "pending / success / failed / refunded",
  refund_reason: "退款原因（支付后未发货）",
  refund_amount: 0,  // 退款金额（全额退款）
  created_at: Date,
  updated_at: Date
}
```

**6. shipping_info（物流信息集合）**
```javascript
{
  _id: "物流记录ID",
  order_id: "订单ID",
  shipping_provider: "快递公司",
  tracking_number: "运单号",
  tracking_status: "pending / in_transit / delivered",  // 直接读取快递100 API
  estimated_delivery_date: Date,
  actual_delivery_date: Date,
  waybill_url: "电子面单URL",
  
  // 发货超时提醒
  shipping_reminder_sent: false,  // 是否已发送发货提醒
  
  // 物流查询控制
  last_query_time: Date,  // 上次查询物流时间
  is_signed: false,  // 是否已签收（签收后不再查询）
  
  created_at: Date,
  updated_at: Date
}
```

**7. password_errors（密码错误记录集合）**
```javascript
{
  _id: "记录ID",
  activity_id: "活动ID",
  user_openid: "用户openid",
  error_count: 3,  // 错误次数
  last_error_time: Date,  // 最后一次错误时间
  is_locked: false,  // 是否已锁定
  created_at: Date,
  updated_at: Date
}
```

#### 云数据库特性

- ✅ **无需建表**：动态创建集合，灵活扩展字段
- ✅ **实时同步**：支持数据实时监听（watch）
- ✅ **权限控制**：基于用户角色的数据访问权限
- ✅ **自动备份**：云端自动备份，数据安全
- ✅ **弹性扩容**：按需扩展存储和并发能力

---

### 3.5 外部活动展示模块（增强粘性）

- **外部活动定义**：非本平台的线上直播活动（抖音、小红书、视频号、快手等）
- 主播可手动录入外部活动信息（平台、时间、主题）
- 粉丝可查看主播历史活动记录和时间线展示
- 增强主播信任感与曝光度

---

## 四、云函数自动化逻辑

### 4.1 云函数架构

采用**腾讯云函数（Serverless）**，实现按需计费、自动扩缩容。

| 云函数名称 | 功能描述 | 触发方式 |
|-----------|---------|----------|
| **auth** | 用户认证、注册、登录 | HTTP API / 小程序调用 |
| **activities** | 活动创建、查询、更新 | HTTP API / 小程序调用 |
| **items** | 物品上传、AI识别、库存管理 | HTTP API / 小程序调用 |
| **orders** | 订单创建、查询、状态更新 | HTTP API / 小程序调用 |
| **payments** | 支付处理、确认、退款 | HTTP API / 微信支付回调 |
| **shipping** | 快递下单、物流查询、面单生成 | HTTP API / 定时触发 |
| **ai-recognition** | AI图像识别、物品分类 | 云函数互调 |
| **analytics** | 数据统计、报表生成 | 定时触发 / HTTP API |

### 4.2 核心云函数逻辑

#### ① AI识别云函数（ai-recognition）

```
// 触发：items 云函数上传图片后调用
const axios = require('axios');

exports.main = async (event) => {
  const { image_base64, activity_id } = event;
  const db = cloud.database();
  
  // 百度AI配置
  const API_KEY = process.env.BAIDU_API_KEY || 'Ynk0D3FhSZO5UVxcLrMMO60R';
  const SECRET_KEY = process.env.BAIDU_SECRET_KEY || 'bTHzNmCKAVE8dKSFGH2HNHg3A4sHCEMA';
  
  try {
    // 1. 获取access_token
    const tokenResponse = await axios.get(
      `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${API_KEY}&client_secret=${SECRET_KEY}`
    );
    const accessToken = tokenResponse.data.access_token;
    
    // 2. 调用百度AI通用物体识别接口
    const recognitionResponse = await axios.post(
      `https://aip.baidubce.com/rest/2.0/image-classify/v2/advanced_general?access_token=${accessToken}`,
      `image=${encodeURIComponent(image_base64)}`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );
    
    const result = recognitionResponse.data;
    
    if (result.result && result.result.length > 0) {
      // 3. 获取第一个识别结果
      const firstResult = result.result[0];
      const keyword = firstResult.keyword;  // 物体名称
      const root = firstResult.root;  // 上层分类
      const score = firstResult.score;  // 置信度
      
      // 4. 映射到系统8个标签
      const systemCategory = mapToSystemCategory(keyword, root);
      const estimatedWeight = getWeightByCategory(systemCategory);
      
      // 5. 生成5位自增数字编号（活动内唯一）
      const itemNumber = await generateItemNumber(activity_id);
      
      // 6. 返回结果
      return {
        success: true,
        category: systemCategory,  // 系统标签
        keyword: keyword,  // 原始识别名称
        weight: estimatedWeight,  // 估算重量
        itemNumber: itemNumber,  // 5位编号
        suggestedTitle: keyword,  // 推荐标题
        confidence: score  // 置信度
      };
    } else {
      // AI识别失败，返回错误信息
      return {
        success: false,
        error: 'AI识别未找到结果',
        needManualInput: true,
        itemNumber: await generateItemNumber(activity_id),  // 仍生成编号
        useDefaultPrice: true  // 使用默认报价
      };
    }
  } catch (error) {
    // AI识别失败，需要主播手动选择分类
    return {
      success: false,
      error: error.message,
      needManualInput: true,
      itemNumber: await generateItemNumber(activity_id),
      useDefaultPrice: true
    };
  }
};

// 百度AI识别结果映射到系统8个标签
function mapToSystemCategory(keyword, root) {
  const keywordLower = keyword.toLowerCase();
  const rootLower = (root || '').toLowerCase();
  
  // 电子产品
  if (keywordLower.includes('手机') || keywordLower.includes('电脑') || 
      keywordLower.includes('相机') || keywordLower.includes('耳机') ||
      rootLower.includes('电子') || rootLower.includes('数码')) {
    return '电子产品';
  }
  
  // 服装
  if (keywordLower.includes('衣服') || keywordLower.includes('裤子') || 
      keywordLower.includes('鞋子') || keywordLower.includes('包包') ||
      rootLower.includes('服装') || rootLower.includes('鞋帽')) {
    return '服装';
  }
  
  // 图书
  if (keywordLower.includes('书籍') || keywordLower.includes('杂志') || 
      keywordLower.includes('文具') || rootLower.includes('书本')) {
    return '图书';
  }
  
  // 化妆品
  if (keywordLower.includes('口红') || keywordLower.includes('香水') || 
      keywordLower.includes('护肤') || rootLower.includes('化妆品')) {
    return '化妆品';
  }
  
  // 玩具
  if (keywordLower.includes('玩具') || keywordLower.includes('娃娃') || 
      keywordLower.includes('模型') || rootLower.includes('玩具')) {
    return '玩具';
  }
  
  // 食品
  if (keywordLower.includes('零食') || keywordLower.includes('饮料') || 
      keywordLower.includes('食品') || rootLower.includes('食品')) {
    return '食品';
  }
  
  // 家居
  if (keywordLower.includes('沙发') || keywordLower.includes('抱枕') || 
      keywordLower.includes('家具') || rootLower.includes('家居')) {
    return '家居';
  }
  
  // 默认分类
  return '其他';
}

// 根据分类获取预设重量
function getWeightByCategory(category) {
  const weightMap = {
    '电子产品': 0.5,
    '服装': 0.3,
    '图书': 0.4,
    '化妆品': 0.2,
    '玩具': 0.3,
    '食品': 0.5,
    '家居': 0.6,
    '其他': 0.5
  };
  return weightMap[category] || 0.5;
}

// 生成5位自增数字编号的函数（范围：00000-99999）
async function generateItemNumber(activity_id) {
  const db = cloud.database();
  
  // 查询该活动下最大的编号
  const result = await db.collection('items')
    .where({ activity_id })
    .orderBy('item_number', 'desc')
    .limit(1)
    .get();
  
  let nextNumber = 1;
  if (result.data.length > 0) {
    const maxNumber = parseInt(result.data[0].item_number);
    nextNumber = maxNumber + 1;
  }
  
  // 转换为5位数字字符串（如 "00001""00123"）
  return nextNumber.toString().padStart(5, '0');
}
```

#### ② 运费计算云函数（shipping.calculateCost）

```javascript
// 触发：粉丝下单时调用
exports.calculateCost = async (event) => {
  const { from_address, to_address, order_items, designated_courier } = event;
  
  // 1. 多次调用快递100 API，查询每个物品的官方报价
  const officialPrices = [];
  
  for (const item of order_items) {
    // 为每个物品单独查询官方报价
    const price = await kuaidi100API.queryPrice({
      sendAddr: from_address.province + from_address.city,
      recAddr: to_address.province + to_address.city,
      weight: item.weight || 0.5,  // 使用AI估算重量，失败时用默认值
      kuaidicom: designated_courier || 'shunfeng',  // 指定快递或默认顺丰
    });
    
    officialPrices.push({
      item_id: item.item_id,
      official_price: price,  // 快递100官方报价
      weight: item.weight
    });
  }
  
  // 2. 取最高官方报价作为基础运费
  const maxOfficialPrice = Math.max(...officialPrices.map(p => p.official_price));
  
  // 3. 计算总费用（粉丝支付）
  const packagingFee = order_items.length * 2.0;  // 包装费：2元/个
  const serviceFee = (maxOfficialPrice + packagingFee) * 0.05;  // 服务费：5%
  const totalAmount = maxOfficialPrice + packagingFee + serviceFee;
  
  // 4. 获取协议价（后台配置，不对外展示）
  const agreementPrice = await getAgreementPrice({
    courier: designated_courier || 'shunfeng',
    weight: order_items.reduce((sum, item) => sum + (item.weight || 0.5), 0)
  });
  
  // 5. 计算平台成本
  const actualPackagingCost = order_items.length * 1.5;  // 实际包装成本
  const totalCost = agreementPrice + actualPackagingCost;
  
  // 6. 计算平台利润
  const platformProfit = totalAmount - totalCost;
  
  // 7. 返回费用明细
  return {
    // 展示给粉丝的价格
    official_base_shipping: maxOfficialPrice,  // 官方报价（取最高）
    packaging_fee: packagingFee,  // 包装费
    service_fee: serviceFee,  // 平台服务费
    total_amount: totalAmount,  // 粉丝支付总额
    
    // 后台成本（不展示）
    agreement_shipping_cost: agreementPrice,  // 协议价
    actual_packaging_cost: actualPackagingCost,  // 真实包装成本
    total_cost: totalCost,  // 平台总成本
    
    // 平台利润
    platform_profit: platformProfit,
    
    // 每个物品的官方报价（用于记录）
    item_prices: officialPrices
  };
};
```

#### ③ 订单自动下单云函数（shipping.createWaybill）

```javascript
// 触发：支付成功后自动调用
exports.createWaybill = async (event) => {
  const { order_id } = event;
  const db = cloud.database();
  
  // 1. 查询订单信息
  const order = await db.collection('orders').doc(order_id).get();
  
  // 2. 调用快递 API 下单
  const waybill = await expressAPI.createOrder({
    from_address: order.data.from_address,
    to_address: order.data.shipping_address,
    contact: order.data.shipping_contact_name,
    phone: order.data.shipping_contact_phone,
    weight: order.data.estimated_weight
  });
  
  // 3. 保存物流信息
  await db.collection('shipping_info').add({
    data: {
      order_id: order_id,
      tracking_number: waybill.tracking_number,
      waybill_url: waybill.pdf_url,
      shipping_provider: waybill.provider,
      created_at: new Date()
    }
  });
  
  // 4. 更新订单状态
  await db.collection('orders').doc(order_id).update({
    data: {
      order_status: 'shipped',
      updated_at: new Date()
    }
  });
  
  return { success: true, tracking_number: waybill.tracking_number };
};
```

### 4.3 自动化任务调度

| 阶段 | 云函数行为 | 主播参与 | API调用 |
|-------|------------|----------|----------|
| 上传照片 | `items` 云函数 → 调用 `ai-recognition` → 识别分类+重量 | ✅ （AI失败时） | 百度AI接口 |
| 活动创建 | 使用预设运费模板，**不调用快递API** | ❌ | 无 |
| 粉丝下单 | `orders` 云函数 → 多次调用快递API查询每个物品官方报价 → 取最高作为基础运费 | ❌ | 快递100查询接口 |
| 库存管理 | `items` 云函数 → 自动更新 remaining_quantity | ❌ | 无 |
| 支付成功 | `payments` 确认支付 → 触发 `shipping.createWaybill` | ❌ | 快递100下单接口 |
| 物流同步 | 定时云函数（每6小时） → 查询未签收订单物流状态 | ❌ | 快递100查询接口 |
| 订单匹配 | `orders` 云函数 → 根据 item_number 自动配对 | ❌ | 无 |
| 超时处理 | 定时云函数 → 检查15分钟未支付订单 → 系统自动取消并释放库存 | ❌ | 无 |
| 发货提醒 | 定时云函数 → 检查48小时未发货 → 发送提醒通知 | ❌ | 无 |

---

## 五、收益模型（平台端）

| 来源 | 描述 | 收益 |
|------|------|------|
| **运费差价** | 系统报价（粉丝支付）与真实快递费用之间的差价 | 主要利润来源 |
| 广告展示 | 主播赠送页可植入品牌广告 | CPM 模式 |
| 增值功能 | 主播可购买「曝光优先级」或「数据分析报告」 | 增值订阅 |

**利润计算公式**：
```
单笔订单利润 = 粉丝支付总额 - （真实快递费 + 真实包装费）
总利润 = ∑ 单笔订单利润
```

---

## 六、用户粘性与信任机制

- 展示主播历史赠送总量与外部活动记录
- **晒单功能**：粉丝可上传收货照片，无需审核，恶意内容可删除
- **无积分体系**：暂不引入积分或奖励机制
- 已验证活动带蓝标（官方审核）
- 粉丝下单自动订阅物流通知
- 赠品类型多样化 → 可推荐相似主播（AI分类标签匹配）

---

## 七、数据统计模块

### 7.1 主播视角统计（analytics 云函数）

- **总赠送量**：累计赠出的物品数量
- **活动次数**：发起的活动总数

### 7.2 平台视角统计（analytics 云函数）

- **总订单数**：平台所有订单数量
- **GMV**：总交易金额（粉丝支付总额）
- **运费差价收益**：总利润 = 粉丝支付总额 - 真实成本总额
- **活跃用户数**：DAU/MAU

### 7.3 统计时间维度

- **日报**：每日数据汇总
- **周报**：每周数据汇总
- **月报**：每月数据汇总

### 7.4 报表导出

- **不支持导出**：暂不提供报表导出功能

---

## 八、版本规划

| 版本 | 功能范围 |
|------|-----------|
| V1.0 | 主播注册 + 批量上架 + AI识别 + 自动运费 + 订单自动化 |
| V1.1 | 赠品标记 + 快递扫码配对发货 |
| V1.2 | 外部活动时间线 + 晒单激励体系 |
| V1.3 | 主播影响力排名 + 粉丝积分成长体系 |

---

## 九、总结

> 本产品围绕「主播最小操作 + AI驱动自动化 + 平台赚取差价」设计，  
> 实现从上传 → 识别 → 定价 → 发货 → 统计的全链路智能闭环。  
> 主播无需处理运费与订单，粉丝获得可靠体验，  
> 平台以运费差价为利润核心，辅以数据、广告与增值空间，  
> 构建一个轻资产高粘性的「主播赠送经济平台」。