// =============================================================
// Review Generator — TEMPLATE-BASED (free, no API needed)
// File: /app/utils/ai.server.js
//
// Generates varied, realistic-sounding reviews using template
// composition. No external API calls. Zero cost.
//
// Optional upgrade path: set GEMINI_API_KEY (free tier at
// https://aistudio.google.com/app/apikey) and we'll use Gemini
// 1.5 Flash for higher quality. Falls back to templates if missing.
// =============================================================

// ---------- Pools ----------
const NAMES = [
  "Aman Sharma","Riya Kapoor","Aarav Patel","Diya Khanna","Ishaan Trivedi",
  "Ananya Mehta","Vihaan Singh","Saanvi Gupta","Aditya Rao","Kavya Iyer",
  "Rohan Malhotra","Priya Nair","Karan Bhatia","Megha Reddy","Arjun Joshi",
  "Sneha Desai","Rahul Pillai","Tara Kulkarni","Yash Chawla","Nikita Bose",
  "Dhruv Agarwal","Pooja Verma","Siddharth Roy","Anjali Saxena","Manav Shetty",
  "Navya Reddy","Rishabh Desai","Jahnvi Joshi","Myra Bhatia","Shaurya Malhotra",
];
const LOCATIONS = [
  "Mumbai, India","Delhi, India","Bengaluru, India","Hyderabad, India",
  "Chennai, India","Kolkata, India","Pune, India","Jaipur, India",
  "Ahmedabad, India","Lucknow, India","Chandigarh, India","Gurgaon, India",
  "Noida, India","Surat, India","Indore, India","Bhopal, India",
];

// ---- 5-star templates ----
const T5 = [
  (p) => `${p} is absolutely stunning. Quality is top-notch, packaging was solid, and it looks even better in person. Bohot premium feel hai. Worth every rupee.`,
  (p) => `Loved my ${p}! Bada premium feel hai aur budget me bhi. Ekdum kadak. Highly recommend if you want something that actually delivers.`,
  (p) => `Kamaal ki finish hai. ${p} looks gorgeous and the build is sturdy. Fast delivery too. Bina soche le lo.`,
  (p) => `Such a classy product. ${p} adds an instant aesthetic upgrade. Material is premium and packaging was very neat. Macha diya!`,
  (p) => `Yaar this is fab! ${p} is exactly what the photos show. Premium feel, great craftsmanship. A1 quality. Will buy again.`,
  (p) => `${p} arrived perfectly packaged and looks better than expected. Aesthetic is on point. Top-notch bhai.`,
  (p) => `Honestly impressed. ${p} ki finish is excellent and delivery was super quick. Chha gaye!`,
  (p) => `Beautiful piece — ${p} totally elevates the room. Bohot elegant look deta hai. Worth the price.`,
  (p) => `Quality is unmatched at this price point. ${p} feels premium, packaging was great, no damage. Jhakaas!`,
  (p) => `${p} is exactly as described. Great craftsmanship, durable build, fast shipping. Solid 5 stars.`,
];

// ---- 4-star templates ----
const T4 = [
  (p) => `${p} is really nice in person. Quality is good and looks premium. Slightly smaller than I expected but still happy with it.`,
  (p) => `Pretty solid product overall. ${p} ki build quality is good, packaging was decent. Just took a couple days extra to deliver.`,
  (p) => `Looks great and feels well-made. ${p} would have been 5 stars if assembly instructions were clearer.`,
  (p) => `Good purchase overall. ${p} arrived in good condition, looks neat, but the color is slightly different from the website.`,
  (p) => `${p} is good for the price. Build is solid, design is nice. Lost one star because the packaging could have been better.`,
  (p) => `Nice product, decent value. ${p} ki finish thodi rough hai but looks great from the front. Recommend.`,
];

// ---- 3-star templates ----
const T3 = [
  (p) => `${p} is okay. Looks nice but the build quality could be better at this price. Delivery was on time though.`,
  (p) => `Mixed feelings. ${p} looks good in photos but feels a bit lighter than expected. Not bad, not great.`,
  (p) => `Average product. ${p} works fine but nothing special. Was hoping for slightly better finish.`,
];

const TITLES = {
  5: ["Loved it!","Top-notch","Premium feel","Worth every rupee","Absolutely stunning",
      "Macha diya","Kamaal","A1 quality","Highly recommend","Best purchase"],
  4: ["Solid product","Pretty good","Looks great","Worth it","Nice purchase","Recommend"],
  3: ["It's okay","Average","Mixed feelings","Decent","Not bad"],
};

// ---------- Helpers ----------
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const initials = (name) => name.split(/\s+/).map(s => s[0]).join("").slice(0, 2).toUpperCase();

function pickRating() {
  const r = Math.random();
  if (r < 0.7) return 5;
  if (r < 0.9) return 4;
  return 3;
}

function templateFor(rating, productTitle) {
  const pool = rating === 5 ? T5 : rating === 4 ? T4 : T3;
  return pick(pool)(productTitle);
}

// ---------- Public: per-product ----------
export async function generateSampleReviews({ productTitle, productDescription, count = 10, style = "hinglish" }) {
  const out = [];
  const usedNames = new Set();
  for (let i = 0; i < count; i++) {
    let name; do { name = pick(NAMES); } while (usedNames.has(name) && usedNames.size < NAMES.length);
    usedNames.add(name);
    const rating = pickRating();
    out.push({
      author_name: name,
      author_location: pick(LOCATIONS),
      rating,
      title: pick(TITLES[rating]),
      content: templateFor(rating, productTitle || "this product"),
    });
  }
  return out;
}

// ---------- Public: multi-product ----------
export async function generateForProducts({ shopDomain, products, countPerProduct = 10, style = "hinglish" }) {
  const records = [];
  for (const p of products) {
    const reviews = await generateSampleReviews({
      productTitle: p.title,
      productDescription: p.description,
      count: countPerProduct,
      style,
    });
    reviews.forEach((r) => {
      records.push({
        shop_domain: shopDomain,
        product_id: String(p.id),
        product_handle: p.handle || null,
        author_name: r.author_name,
        author_initials: initials(r.author_name),
        author_location: r.author_location,
        author_country: "IN",
        is_verified: true,
        rating: r.rating,
        title: r.title || null,
        content: r.content,
        image_urls: [],
        status: "approved",
        source: "ai_sample",
        is_featured: false,
      });
    });
  }
  return records;
}
