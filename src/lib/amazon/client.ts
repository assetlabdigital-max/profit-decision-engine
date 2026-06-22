export type AmazonProduct = {
  asin: string;
  title: string;
  price: number;
  salesRank?: number;
  rating?: number;
  reviews?: number;
};

export async function fetchAmazonProduct(asin: string): Promise<AmazonProduct> {
  const KEEP_KEY = process.env.KEEPA_API_KEY;

  // 👉 실제 API 연결 (Keepa 기준)
  if (KEEP_KEY) {
    const res = await fetch(
      `https://api.keepa.com/product?key=${KEEP_KEY}&domain=1&asin=${asin}`
    );

    const data = await res.json();

    const p = data?.products?.[0];

    return {
      asin,
      title: p?.title || "Unknown Product",
      price: p?.stats?.current?.[0] ? p.stats.current[0] / 100 : 0,
      salesRank: p?.stats?.salesRank?.[0],
      rating: p?.csv?.[16]?.slice(-1)[0],
      reviews: p?.reviews || 0,
    };
  }

  // 👉 fallback (절대 삭제 금지)
  return {
    asin,
    title: `Mock Product ${asin}`,
    price: Math.floor(Math.random() * 100) + 20,
    salesRank: Math.floor(Math.random() * 50000),
    rating: 4 + Math.random(),
    reviews: Math.floor(Math.random() * 5000),
  };
}