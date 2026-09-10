"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const methods = [
  "Sadad (Almadar)",
  "Mobicash",
  "Local bank card",
  "Bank transfer",
];

function PaymentContent() {
  const searchParams = useSearchParams();

  // قراءة القيم القادمة في URL
  const planParam = (searchParams.get("plan") || "").toLowerCase().trim();
  const priceParam = searchParams.get("price");

  // دالة حساب السعر بدقة
  const calculatePrice = () => {
    // 1. إذا تم تمرير السعر مباشرة في الرابط (مثل price=50) يتم اعتماده فوراً
    if (priceParam && !isNaN(Number(priceParam)) && Number(priceParam) > 0) {
      return Number(priceParam);
    }

    // 2. إذا كانت الخطة هي الثالثة (العملاقة / Enterprise)
    if ( 
      planParam.includes("max")
    ) {
      return 70;
    }

    //  3. إذا كانت الخطة هي الوسطى (Pro / Business / Medium)
    if (
planParam.includes("pro") && planParam.includes("Pro") 
    ) {
      return 50; // السعر الجديد للخطة الوسطى
    }
     if (
            planParam.includes("Enterprise") ||
      planParam.includes("350") ||
      planParam.includes("enterprise")
  
    ){
      return 350; // السعر الجديد للخطة الوسطى
    }
     if (
      planParam === "150" ||
      planParam.includes("Business Pro") 
  
    ){
      return 150; // السعر الجديد للخطة الوسطى
    }

    // 4. الخطة المجانية
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
                  method === item ? "border-orange-500" : ""
                }`}
              >
                <input
                  type="radio"
                  checked={method === item}
                  onChange={() => setMethod(item)}
                />

                <span className="ml-4">{item}</span>
              </label>
            ))}
          </div>

          <input
            className="border rounded-lg p-3 w-full mt-8"
            placeholder="Sadad phone number"
          />
        </div>

        <div className="border rounded-xl p-6 h-fit">
          <h2 className="font-bold">Order Summary</h2>

          <div className="flex justify-between mt-6">
            <span>{getPlanName()}</span>
            <span>{planPrice} LYD</span>
          </div>

          <div className="flex justify-between mt-2">
            <span>Fees</span>
            <span>0 LYD</span>
          </div>

          <hr className="my-6" />

          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{planPrice} LYD</span>
          </div>

          <button className="w-full mt-8 bg-orange-600 text-white py-3 rounded-lg">
            Confirm & Pay
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