/**
 * Roman English -> Urdu SCRIPT transliteration (not translation).
 *
 * "Chicken Panini" becomes "چکن پنینی" — the same English words, written in
 * Urdu letters, so Urdu-reading kitchen staff can read the ticket aloud.
 * Nothing is translated; meaning and word order stay exactly as typed.
 */

/** Words the kitchen sees constantly, spelled the way people actually write them in Urdu. */
const WORDS: Record<string, string> = {
  cafe: "کیفے",
  tea: "چائے",
  chai: "چائے",
  coffee: "کافی",
  latte: "لاٹے",
  cappuccino: "کیپوچینو",
  americano: "امریکانو",
  mocha: "موکا",
  espresso: "ایسپریسو",
  water: "واٹر",
  juice: "جوس",
  milk: "ملک",
  milkshake: "ملک شیک",
  shake: "شیک",
  sugar: "شوگر",
  hot: "ہاٹ",
  cold: "کولڈ",
  iced: "آئسڈ",
  large: "لارج",
  small: "سمال",
  regular: "ریگولر",
  medium: "میڈیم",
  extra: "ایکسٹرا",
  no: "نو",
  with: "ودھ",
  without: "وداؤٹ",
  and: "اینڈ",
  meal: "میل",
  deal: "ڈیل",
  combo: "کومبو",
  chicken: "چکن",
  beef: "بیف",
  lamb: "لیم",
  fish: "فش",
  tuna: "ٹونا",
  cheese: "چیز",
  egg: "ایگ",
  eggs: "ایگز",
  bacon: "بیکن",
  sausage: "ساسج",
  mayo: "میو",
  salad: "سلاد",
  chips: "چپس",
  fries: "فرائز",
  wedges: "ویجز",
  beans: "بینز",
  toast: "ٹوسٹ",
  bread: "بریڈ",
  butter: "بٹر",
  jam: "جیم",
  sandwich: "سینڈوچ",
  sandwiches: "سینڈوچز",
  toastie: "ٹوسٹی",
  panini: "پنینی",
  baguette: "بیگٹ",
  wrap: "ریپ",
  roll: "رول",
  burger: "برگر",
  jacket: "جیکٹ",
  potato: "پوٹیٹو",
  potatoes: "پوٹیٹوز",
  fillings: "فلنگز",
  filling: "فلنگ",
  breakfast: "بریک فاسٹ",
  english: "انگلش",
  full: "فل",
  curry: "کری",
  rice: "رائس",
  chips_and: "چپس اینڈ",
  soup: "سوپ",
  pasta: "پاستا",
  pizza: "پیزا",
  cake: "کیک",
  muffin: "مفن",
  cookie: "کوکی",
  biscuit: "بسکٹ",
  croissant: "کروسان",
  chocolate: "چاکلیٹ",
  bar: "بار",
  crisps: "کرسپس",
  snack: "سنیک",
  snacks: "سنیکس",
  drink: "ڈرنک",
  drinks: "ڈرنکس",
  can: "کین",
  bottle: "بوتل",
  order: "آرڈر",
  table: "ٹیبل",
  delivery: "ڈلیوری",
  takeaway: "ٹیک اوے",
  collection: "کلیکشن",
  dine: "ڈائن",
  in: "ان",
  jury: "جیوری",
  judge: "جج",
  room: "روم",
  lounge: "لاؤنج",
  court: "کورٹ",
  crown: "کراؤن",
  public: "پبلک",
  side: "سائیڈ",
  other: "ادر",
  items: "آئٹمز",
  item: "آئٹم",
  ready: "ریڈی",
  cash: "کیش",
  card: "کارڈ",
  note: "نوٹ",
  cook: "کک",
  cooking: "ککنگ",
  needed: "نیڈڈ",
  food: "فوڈ",
  web: "ویب",
  till: "ٹل",
  deliveroo: "ڈیلیوروو",
  uber: "اوبر",
  eats: "ایٹس",
  just: "جسٹ",
  eat: "ایٹ",
};

const DIGRAPHS: [RegExp, string][] = [
  [/^kh/, "خ"],
  [/^gh/, "غ"],
  [/^ch/, "چ"],
  [/^sh/, "ش"],
  [/^ph/, "ف"],
  [/^th/, "تھ"],
  [/^bh/, "بھ"],
  [/^dh/, "دھ"],
  [/^ck/, "ک"],
  [/^qu/, "کو"],
  [/^ng/, "نگ"],
  [/^ee/, "ی"],
  [/^ea/, "ی"],
  [/^oo/, "و"],
  [/^ou/, "او"],
  [/^ow/, "او"],
  [/^au/, "او"],
  [/^aw/, "او"],
  [/^ai/, "ائی"],
  [/^ay/, "ے"],
  [/^ei/, "ی"],
  [/^ie/, "ی"],
  [/^aa/, "ا"],
  [/^oa/, "و"],
];

const CONSONANTS: Record<string, string> = {
  b: "ب",
  c: "ک",
  d: "ڈ",
  f: "ف",
  g: "گ",
  h: "ہ",
  j: "ج",
  k: "ک",
  l: "ل",
  m: "م",
  n: "ن",
  p: "پ",
  q: "ق",
  r: "ر",
  s: "س",
  t: "ٹ",
  v: "و",
  w: "و",
  x: "کس",
  y: "ی",
  z: "ز",
};

const INITIAL_VOWEL: Record<string, string> = { a: "ا", e: "ای", i: "ای", o: "او", u: "او" };
const FINAL_VOWEL: Record<string, string> = { a: "ا", e: "ے", i: "ی", o: "و", u: "و" };
const MEDIAL_VOWEL: Record<string, string> = { a: "", e: "ی", i: "", o: "و", u: "و" };

function transliterateWord(word: string): string {
  const known = WORDS[word];
  if (known) return known;
  let out = "";
  let index = 0;
  while (index < word.length) {
    const rest = word.slice(index);
    const digraph = DIGRAPHS.find(([pattern]) => pattern.test(rest));
    if (digraph) {
      out += digraph[1];
      index += 2;
      continue;
    }
    const letter = rest[0]!;
    if (letter in CONSONANTS) {
      out += CONSONANTS[letter];
    } else if (letter in INITIAL_VOWEL) {
      const last = index + 1 >= word.length;
      out += index === 0 ? INITIAL_VOWEL[letter] : last ? FINAL_VOWEL[letter] : MEDIAL_VOWEL[letter];
    }
    index += 1;
  }
  return out || word;
}

const cache = new Map<string, string>();

/**
 * Rewrites English text in Urdu letters. Numbers, prices, order codes and any
 * word that is already non-Latin are left untouched.
 */
export function toUrduScript(text: string): string {
  if (!text) return "";
  const cached = cache.get(text);
  if (cached !== undefined) return cached;
  const out = text.replace(/[A-Za-z]+/g, (word) => {
    const lower = word.toLowerCase();
    // Leave shouty codes and initialisms (KDS, TGTG, AL1) as they are.
    if (word.length <= 3 && word === word.toUpperCase() && !WORDS[lower]) return word;
    return transliterateWord(lower);
  });
  cache.set(text, out);
  return out;
}
