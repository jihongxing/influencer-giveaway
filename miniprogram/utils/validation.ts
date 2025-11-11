// Validation utilities for WeChat Mini Program

/**
 * Validate Chinese mobile phone number
 * Format: 11 digits, starts with 1, second digit 3-9
 */
export function validatePhoneNumber(phone: string): boolean {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate shipping address format
 */
export interface ShippingAddress {
  province: string;
  city: string;
  district: string;
  street: string;
  postal_code?: string;
}

export function validateShippingAddress(address: ShippingAddress): {
  valid: boolean;
  message?: string;
} {
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
export function validateContactName(name: string): {
  valid: boolean;
  message?: string;
} {
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
export function validatePostalCode(code: string): boolean {
  if (!code || code.trim() === '') {
    return true; // Optional field
  }
  const postalCodeRegex = /^\d{6}$/;
  return postalCodeRegex.test(code);
}

