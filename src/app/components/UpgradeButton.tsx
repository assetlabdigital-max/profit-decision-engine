"use client";

export default function UpgradeButton({ email }: { email: string }) {
  async function handleUpgrade() {
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Unable to create Stripe checkout.");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      alert("Stripe checkout URL was not returned.");
    } catch (err) {
      console.error(err);
      alert("Stripe server error.");
    }
  }

  return (
    <button
      onClick={handleUpgrade}
      style={{
        padding: "10px 18px",
        borderRadius: 8,
        background: "#111",
        color: "#fff",
        border: "none",
        cursor: "pointer",
        marginTop: 12,
      }}
    >
      Upgrade to Pro
    </button>
  );
}