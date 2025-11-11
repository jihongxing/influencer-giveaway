// WeChat Pay service for Mini Program
import apiService from './api';

export interface PaymentParams {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: string;
  paySign: string;
}

export interface ClaimItemResult {
  order_id: number;
  item_id: number;
  total_amount: number;
  breakdown: {
    packaging_fee: number;
    shipping_cost: number;
    platform_fee: number;
  };
  payment_params: PaymentParams;
}

class PaymentService {
  /**
   * Claim an item and get payment parameters
   */
  async claimItem(
    itemId: number,
    shippingAddress: {
      province: string;
      city: string;
      district: string;
      street: string;
      postal_code?: string;
    },
    shippingContactName: string,
    shippingContactPhone: string
  ): Promise<ClaimItemResult> {
    const response = await apiService.post<ClaimItemResult>('/orders/claim', {
      item_id: itemId,
      shipping_address: shippingAddress,
      shipping_contact_name: shippingContactName,
      shipping_contact_phone: shippingContactPhone,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || '声明物品失败');
    }

    return response.data;
  }

  /**
   * Request WeChat Pay
   */
  async requestPayment(paymentParams: PaymentParams): Promise<void> {
    return new Promise((resolve, reject) => {
      wx.requestPayment({
        timeStamp: paymentParams.timeStamp,
        nonceStr: paymentParams.nonceStr,
        package: paymentParams.package,
        signType: paymentParams.signType,
        paySign: paymentParams.paySign,
        success: () => {
          resolve();
        },
        fail: (err) => {
          reject(err);
        },
      });
    });
  }

  /**
   * Confirm payment after WeChat Pay success
   */
  async confirmPayment(orderId: number, transactionId: string): Promise<void> {
    const response = await apiService.post(`/orders/${orderId}/confirm-payment`, {
      wechat_transaction_id: transactionId,
    });

    if (!response.success) {
      throw new Error(response.error?.message || '确认支付失败');
    }
  }

  /**
   * Complete payment flow: claim item, request payment, confirm payment
   */
  async completePaymentFlow(
    itemId: number,
    shippingAddress: {
      province: string;
      city: string;
      district: string;
      street: string;
      postal_code?: string;
    },
    shippingContactName: string,
    shippingContactPhone: string
  ): Promise<{
    orderId: number;
    transactionId?: string;
  }> {
    // Step 1: Claim item
    const claimResult = await this.claimItem(
      itemId,
      shippingAddress,
      shippingContactName,
      shippingContactPhone
    );

    // Step 2: Request WeChat Pay
    try {
      await this.requestPayment(claimResult.payment_params);

      // Step 3: Get transaction ID from payment result
      // Note: In real implementation, transaction ID comes from WeChat Pay callback
      // For now, we'll use a placeholder
      const transactionId = `wx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Step 4: Confirm payment
      await this.confirmPayment(claimResult.order_id, transactionId);

      return {
        orderId: claimResult.order_id,
        transactionId,
      };
    } catch (error) {
      // Payment failed or cancelled
      throw error;
    }
  }
}

export const paymentService = new PaymentService();
export default paymentService;

