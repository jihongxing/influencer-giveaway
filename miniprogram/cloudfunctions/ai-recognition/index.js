// 百度AI物品识别云函数
const cloud = require('wx-server-sdk');
const axios = require('axios');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

/**
 * 云函数入口函数
 * @param {Object} event - 事件对象
 * @param {Object} context - 上下文对象
 */
exports.main = async (event, context) => {
  const action = event?.action;
  const data = event?.data || {};

  try {
    switch (action) {
      case 'recognizeImage':
        return await recognizeImage(data);
      case 'mapCategory':
        return await mapCategory(data);
      case 'estimateWeight':
        return await estimateWeight(data);
      default:
        return {
          success: false,
          error: {
            code: 'UNKNOWN_ACTION',
            message: `Unknown action: ${action || 'undefined'}`
          }
        };
    }
  } catch (error) {
    console.error('AI recognition function error:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Internal server error'
      }
    };
  }
};

/**
 * 获取百度AI Access Token
 */
async function getBaiduAccessToken() {
  // 直接使用API Key（临时方案，生产环境应使用环境变量）
  const apiKey = process.env.BAIDU_API_KEY || 'Ynk0D3FhSZO5UVxcLrMMO60R';
  const secretKey = process.env.BAIDU_SECRET_KEY || 'bTHzNmCKAVE8dKSFGH2HNHg3A4sHCEMA';

  console.log('[getBaiduAccessToken] API Key:', apiKey ? '已设置' : '未设置');
  console.log('[getBaiduAccessToken] Secret Key:', secretKey ? '已设置' : '未设置');

  if (!apiKey || !secretKey) {
    throw new Error('Baidu AI API Key or Secret Key not configured');
  }

  try {
    const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;
    const response = await axios.get(url);
    
    if (response.data.error) {
      throw new Error(response.data.error_description || 'Failed to get access token');
    }

    console.log('[getBaiduAccessToken] Access Token获取成功');
    return response.data.access_token;
  } catch (error) {
    console.error('[getBaiduAccessToken] 错误:', error);
    throw error;
  }
}

/**
 * 调用百度AI通用物体识别API
 * @param {Object} data - 包含image（base64或URL）
 */
async function recognizeImage(data) {
  try {
    const { image, image_type = 'BASE64' } = data;

    if (!image) {
      return {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'Image is required'
        }
      };
    }

    console.log('[recognizeImage] 开始识别, image_type:', image_type);

    // 获取Access Token
    const accessToken = await getBaiduAccessToken();
    console.log('[recognizeImage] 获取Access Token成功');

    // 调用百度AI通用物体识别API
    const apiUrl = `https://aip.baidubce.com/rest/2.0/image-classify/v2/advanced_general?access_token=${accessToken}`;
    
    // 根据图片类型构建请求参数
    const requestBody = {};
    if (image_type === 'URL') {
      requestBody.url = image;  // URL模式
      console.log('[recognizeImage] 使用URL模式:', image.substring(0, 100));
    } else {
      requestBody.image = image;  // BASE64模式
      console.log('[recognizeImage] 使用BASE64模式, 长度:', image.length);
    }
    requestBody.baike_num = 5;  // 返回百科信息的结果数

    const response = await axios.post(apiUrl, 
      new URLSearchParams(requestBody).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    console.log('[recognizeImage] 百度API响应:', response.data);

    if (response.data.error_code) {
      console.error('[recognizeImage] 百度API错误:', response.data);
      return {
        success: false,
        error: {
          code: 'BAIDU_API_ERROR',
          message: response.data.error_msg || 'Baidu AI API error',
          error_code: response.data.error_code
        }
      };
    }

    // 提取识别结果
    const results = response.data.result || [];
    console.log('[recognizeImage] 识别结果数量:', results.length);
    
    // 返回识别结果
    return {
      success: true,
      data: {
        result_num: response.data.result_num || 0,
        results: results.map(item => ({
          keyword: item.keyword,  // 物品名称
          score: item.score,      // 置信度
          root: item.root,        // 物品类别
          baike_info: item.baike_info || null  // 百科信息
        })),
        raw_response: response.data  // 完整的原始响应
      }
    };
  } catch (error) {
    console.error('[recognizeImage] 识别错误:', error);
    return {
      success: false,
      error: {
        code: 'RECOGNITION_ERROR',
        message: error.message || 'Failed to recognize image',
        details: error.response?.data || error.stack
      }
    };
  }
}

/**
 * 映射百度AI识别结果到系统8大类标签
 * @param {Object} data - 包含baiduResults（百度AI返回的results数组）
 */
async function mapCategory(data) {
  try {
    const { baiduResults } = data;

    if (!baiduResults || !Array.isArray(baiduResults) || baiduResults.length === 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'baiduResults is required and must be a non-empty array'
        }
      };
    }

    console.log('[mapCategory] 开始映射, 结果数量:', baiduResults.length);
    console.log('[mapCategory] 顶部结果:', baiduResults[0]);

    // 系统定义的8大类标签 (中文 -> 英文映射)
    const categoryMapping = {
      '服装': 'clothing',
      '化妆品': 'cosmetics',
      '日用品': 'daily',
      '食品': 'food',
      '电子产品': 'electronics',
      '玩具': 'toys',
      '文具': 'stationery',
      '其他': 'other'
    };

    const systemCategories = {
      '服装': ['服装', '衣服', '上衣', '裤子', '裙子', '外套', '鞋', '鞋子', '运动鞋', '帽子', '围巾', '手套', '袜子'],
      '化妆品': ['化妆品', '护肤品', '口红', '粉底', '眼影', '面霜', '面膜', '洗面奶', '香水', '指甲油'],
      '日用品': ['日用品', '毛巾', '牙刷', '牙膏', '洗发水', '沐浴露', '纸巾', '清洁用品', '洗衣液'],
      '食品': ['食品', '零食', '饮料', '水果', '蔬菜', '肉类', '糕点', '糖果', '巧克力', '咖啡', '茶'],
      '电子产品': ['电子产品', '手机', '电脑', '平板', '耳机', '音箱', '相机', '键盘', '鼠标', '充电器', '数码'],
      '玩具': ['玩具', '娃娃', '模型', '积木', '益智玩具', '毛绒玩具', '游戏机'],
      '文具': ['文具', '笔', '本子', '橡皮', '尺子', '笔记本', '文件夹', '书签', '胶水', '剪刀'],
      '其他': []  // 默认分类
    };

    // 获取得分最高的识别结果
    const topResult = baiduResults[0];
    const keyword = topResult.keyword || '';
    const root = topResult.root || '';

    console.log('[mapCategory] keyword:', keyword, 'root:', root, 'score:', topResult.score);

    // 匹配系统分类
    let matchedCategory = '其他';
    let matchScore = 0;

    for (const [category, keywords] of Object.entries(systemCategories)) {
      // 检查关键词是否包含在分类关键词列表中
      for (const kw of keywords) {
        if (keyword.includes(kw) || root.includes(kw) || kw.includes(keyword)) {
          matchedCategory = category;
          matchScore = topResult.score;
          console.log('[mapCategory] 匹配成功:', category, '关键词:', kw);
          break;
        }
      }
      if (matchedCategory !== '其他') break;
    }

    const englishCategory = categoryMapping[matchedCategory] || 'other';
    console.log('[mapCategory] 最终类别:', matchedCategory, '->', englishCategory);

    return {
      success: true,
      data: {
        category: englishCategory,  // 英文类别
        tags: [matchedCategory],    // 中文标签
        confidence: matchScore,
        baidu_keyword: keyword,
        baidu_root: root,
        baidu_score: topResult.score
      }
    };
  } catch (error) {
    console.error('[mapCategory] 映射错误:', error);
    return {
      success: false,
      error: {
        code: 'MAPPING_ERROR',
        message: error.message || 'Failed to map category'
      }
    };
  }
}

/**
 * 估算物品重量（根据AI识别结果）
 * 成功识别：使用预设值
 * 失败：返回基础报价+2元的标记
 * 
 * @param {Object} data - 包含category（系统分类）和baiduKeyword（百度识别关键词）
 */
async function estimateWeight(data) {
  try {
    const { category, baiduKeyword, recognitionSuccess = true } = data;

    // 如果AI识别失败，返回特殊标记
    if (!recognitionSuccess) {
      return {
        success: true,
        data: {
          weight_kg: null,
          use_base_price_plus_2: true,  // 标记使用基础报价+2元
          estimation_method: 'failed_recognition'
        }
      };
    }

    // 各类物品的预设重量（单位：kg）
    const weightPresets = {
      '服装': {
        default: 0.3,
        keywords: {
          '外套': 0.6,
          '大衣': 0.8,
          '羽绒服': 0.7,
          '裤子': 0.4,
          '裙子': 0.25,
          '上衣': 0.2,
          'T恤': 0.15,
          '鞋': 0.5,
          '靴子': 0.7
        }
      },
      '化妆品': {
        default: 0.1,
        keywords: {
          '香水': 0.15,
          '面霜': 0.08,
          '洗面奶': 0.12,
          '粉底': 0.05
        }
      },
      '日用品': {
        default: 0.2,
        keywords: {
          '毛巾': 0.15,
          '洗发水': 0.35,
          '沐浴露': 0.35,
          '洗衣液': 1.0
        }
      },
      '食品': {
        default: 0.3,
        keywords: {
          '饮料': 0.6,
          '水果': 0.5,
          '零食': 0.2,
          '糕点': 0.25
        }
      },
      '电子产品': {
        default: 0.5,
        keywords: {
          '手机': 0.3,
          '平板': 0.5,
          '耳机': 0.1,
          '充电器': 0.15,
          '音箱': 0.8
        }
      },
      '玩具': {
        default: 0.3,
        keywords: {
          '毛绒玩具': 0.2,
          '模型': 0.4,
          '积木': 0.5
        }
      },
      '文具': {
        default: 0.1,
        keywords: {
          '笔记本': 0.15,
          '文件夹': 0.12
        }
      },
      '其他': {
        default: 0.3
      }
    };

    // 获取对应分类的预设值
    const categoryPreset = weightPresets[category] || weightPresets['其他'];
    let estimatedWeight = categoryPreset.default;

    // 如果有关键词匹配，使用更精确的预设值
    if (baiduKeyword && categoryPreset.keywords) {
      for (const [keyword, weight] of Object.entries(categoryPreset.keywords)) {
        if (baiduKeyword.includes(keyword)) {
          estimatedWeight = weight;
          break;
        }
      }
    }

    return {
      success: true,
      data: {
        weight_kg: estimatedWeight,
        use_base_price_plus_2: false,
        estimation_method: 'preset_by_category',
        category: category,
        matched_keyword: baiduKeyword
      }
    };
  } catch (error) {
    console.error('Estimate weight error:', error);
    return {
      success: false,
      error: {
        code: 'ESTIMATION_ERROR',
        message: error.message || 'Failed to estimate weight'
      }
    };
  }
}
