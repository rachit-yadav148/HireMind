let scriptLoaded = false;

export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (scriptLoaded || window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => {
      scriptLoaded = true;
      resolve(true);
    };
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout({ order, user, onSuccess, onFailure }) {
  const loaded = await loadRazorpayScript();
  if (!loaded) {
    onFailure?.("Failed to load Razorpay. Check your internet connection.");
    return;
  }

  const options = {
    key: order.keyId,
    amount: order.amount,
    currency: order.currency,
    name: "HireMind",
    description: order.planLabel,
    order_id: order.orderId,
    prefill: {
      name: user?.name || "",
      email: user?.email || "",
    },
    theme: {
      color: "#6366f1",
    },
    handler: function (response) {
      onSuccess?.({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
        planId: order.planId,
      });
    },
    modal: {
      ondismiss: function () {
        onFailure?.("Payment cancelled");
      },
    },
  };

  const rzp = new window.Razorpay(options);
  rzp.on("payment.failed", function (response) {
    onFailure?.(response.error?.description || "Payment failed");
  });
  rzp.open();
}
