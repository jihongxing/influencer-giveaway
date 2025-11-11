// Validation utilities for WeChat Mini Program

/**
 * Validate Chinese mobile phone number
 * Format: 11 digits, starts with 1, second digit 3-9
 */
function validatePhoneNumber(phone) {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate shipping address format
 */
function validateShippingAddress(address) {
  if (!address.province || address.province.trim() === '') {
    return { valid: false, message: '请选择省份' };
  }

  if (!address.city || address.city.trim() === '') {
    return { valid: false, message: '请选择城市' };
  }

  if (!address.district || address.district.trim() === '') {
    return { valid: false, message: '请选择区县' };
  }

  if (!address.street || address.street.trim() === '') {
    return { valid: false, message: '请输入详细地址' };
  }

  if (address.street.length < 5) {
    return { valid: false, message: '详细地址至少需要5个字符' };
  }

  return { valid: true };
}

/**
 * Validate contact name
 */
function validateContactName(name) {
  if (!name || name.trim() === '') {
    return { valid: false, message: '请输入联系人姓名' };
  }

  if (name.length < 2 || name.length > 20) {
    return { valid: false, message: '联系人姓名长度应在2-20个字符之间' };
  }

  return { valid: true };
}

/**
 * Validate postal code (optional)
 */
function validatePostalCode(code) {
  if (!code || code.trim() === '') {
    return true; // Optional field
  }
  const postalCodeRegex = /^\d{6}$/;
  return postalCodeRegex.test(code);
}

module.exports = {
  validatePhoneNumber,
  validateShippingAddress,
  validateContactName,
  validatePostalCode,
};

