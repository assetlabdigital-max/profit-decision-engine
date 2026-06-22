export function calculateCompetition(reviewCount: number, rating: number) {
  let score = 0;

  // 리뷰 많으면 경쟁 높음
  if (reviewCount > 1000) score += 3;
  else if (reviewCount > 300) score += 2;
  else score += 1;

  // 평점 높으면 경쟁 강함
  if (rating >= 4.5) score += 2;
  else if (rating >= 4.0) score += 1;

  return {
    score,
    level:
      score >= 4 ? "HIGH" :
      score >= 2 ? "MEDIUM" : "LOW",
  };
}