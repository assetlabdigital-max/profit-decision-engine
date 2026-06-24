"use client";

export default function PricingPage() {
  const handleCheckout = async () => {
    const res = await fetch("/api/checkout", {
      method: "POST",
    });

    const data = await res.json();
    window.location.href = data.url;
  };

  return (
    <div>
      <h1>Upgrade to Pro</h1>

      <button onClick={handleCheckout}>
        Start $9.99 Pro Plan
      </button>
    </div>
  );
}
