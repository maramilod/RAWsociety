"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const methods = [
  "Sadad (Almadar)",
  "Mobicash",
  "Local bank card",
  "Bank transfer",
];

function PaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);

  // قراءة القيم القادمة في URL
  const planParam = (searchParams.get("plan") || "").toLowerCase().trim();
  const priceParam = searchParams.get("price");
  const roleParam = (searchParams.get("role") || "").toLowerCase().trim(); // قراءة الدور (client أم creator)

  // دالة حساب السعر بدقة
  const calculatePrice = () => {
    // 1. إذا تم تمرير السعر مباشرة في الرابط (مثل price=50) يتم اعتماده فوراً
    if (priceParam && !isNaN(Number(priceParam)) && Number(priceParam) > 0) {
      return Number(priceParam);
    }

    // 2. الخطة العملاقة
    if (planParam.includes("max")) {
      return 70;
    }

    // 3. الخطة الوسطى Pro
    if (planParam.includes("pro")) {
      return 50;
    }

    // 4. خطة Enterprise / 350
    if (
      planParam.includes("enterprise") ||
      planParam.includes("350")
    ) {
      return 350;
    }

    // 5. Business Pro / 150
    if (
      planParam === "150" ||
      planParam.includes("business pro")
    ) {
      return 150;
    }

    // 6. الخطة المجانية
    if (planParam === "0" || planParam.includes("free")) {
      return 0;
    }

    // القيمة الافتراضية
    return 150;
  };

  const planPrice = calculatePrice();

  // تحديد اسم الخطة بناءً على السعر
  const getPlanName = () => {
    if (planPrice === 350) return "Enterprise Plan";
    if (planPrice === 50) return "Pro Plan";
    if (planPrice === 0) return "Free Plan";
    return "Pro Plan";
  };

  const [method, setMethod] = useState(methods[0]);
// دالة إتمام الدفع والتوجيه لصفحة الاستكشاف مباشرة
const handlePayment = () => {
  setIsLoading(true);

  // محاكاة تأخير معالجة عملية الدفع ثم التوجيه لصفحة explore
  setTimeout(() => {
    router.push("/explore");
  }, 1500);
};
  // دالة إتمام الدفع والتوجيه للداشبورد
/*   const handlePayment = () => {
    setIsLoading(true);

    // محاكاة تأخير معالجة عملية الدفع ثم التوجيه
   setTimeout(() => {
      if (roleParam === "client") {
        router.push("/dashboard/client");
      } else if (roleParam === "creator") {
        router.push("/dashboard/creator");
      } else {
        // توجيه افتراضي لو لم يتم تحديد role في الرابط
        router.push("/dashboard/creator");
      }
    }, 1500);
  };
*/
  return (
    <main className="max-w-6xl mx-auto p-10">
      <h1 className="text-4xl font-bold text-center">Payment</h1>

      <div className="grid md:grid-cols-3 gap-8 mt-10">
        <div className="md:col-span-2 border rounded-xl p-6">
          <h2 className="font-bold mb-6">Choose payment method</h2>

          <div className="space-y-4">
            {methods.map((item) => (
              <label
                key={item}
                className={`flex items-center border rounded-lg p-4 cursor-pointer ${
                  method === item ? "border-orange-500 bg-orange-50/20" : ""
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={method === item}
                  onChange={() => setMethod(item)}
                />

                <span className="ml-4 font-medium">{item}</span>
              </label>
            ))}
          </div>

          <input
            className="border rounded-lg p-3 w-full mt-8 focus:outline-none focus:border-orange-500"
            placeholder="Sadad phone number"
          />
        </div>

        <div className="border rounded-xl p-6 h-fit bg-white shadow-sm">
          <h2 className="font-bold text-lg">Order Summary</h2>

          <div className="flex justify-between mt-6 text-sm">
            <span>{getPlanName()}</span>
            <span className="font-semibold">{planPrice} LYD</span>
          </div>

          <div className="flex justify-between mt-2 text-sm">
            <span>Fees</span>
            <span className="font-semibold">0 LYD</span>
          </div>

          <hr className="my-6" />

          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>{planPrice} LYD</span>
          </div>

          <button
            onClick={handlePayment}
            disabled={isLoading}
            className="w-full mt-8 bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 rounded-lg transition duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Processing...
              </>
            ) : (
              "Confirm & Pay"
            )}
          </button>
        </div>
      </div>
    </main>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading payment summary...</div>}>
      <PaymentContent />
    </Suspense>
  );
}