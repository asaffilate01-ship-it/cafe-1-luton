import type { LocalSearchPageConfig } from "@/components/local-search-page";

const path = "/halal-food-luton";

export const config: LocalSearchPageConfig = {
  path,
  eyebrow: "Halal food in Luton",
  title: "Halal food for breakfast, lunch and everything between.",
  intro:
    "Every food item served at Café 1 is halal, so you can choose across the café menu rather than search for a separate halal section. Visit Luton Crown Court or Futures House in Marsh Farm.",
  imageAlt: "Halal breakfast and lunch choices from Café 1 Luton including cooked food and sides",
  highlights: [
    {
      title: "One halal food menu",
      text: "Breakfasts, meat dishes, sandwiches and hot lunches are part of the same halal food offer—not a small add-on menu.",
    },
    {
      title: "British and Desi choices",
      text: "Move from cooked breakfast plates and omelettes to parathas, chana, kebabs and curries depending on the meal you want.",
    },
    {
      title: "Vegetarian choices too",
      text: "Vegetarian menu items and modifier choices are labelled separately. Halal and vegetarian describe different dietary needs, so check both labels.",
    },
    {
      title: "Ask before you order",
      text: "For supplier, ingredient, allergen or cross-contact questions, speak to the café team so we can check the current product information.",
    },
  ],
  sections: [
    {
      heading: "What halal means on our menu",
      paragraphs: [
        "Café 1 states that all food it serves is halal. That includes the food offered across breakfast and lunch categories, not only selected meat dishes. We avoid describing an item as independently certified unless the supporting supplier information is available for that product.",
        "Halal status does not by itself answer every dietary question. Allergens, vegetarian requirements and personal preferences still need to be checked separately. The online menu provides useful labels, and the team can help with the latest ingredient information before you commit to an order.",
      ],
      bullets: [
        "Halal cooked breakfasts and breakfast rolls",
        "Halal chicken, lamb and kebab menu choices",
        "Desi breakfast, parathas, chana and curries",
        "Vegetarian and lighter café options alongside meat dishes",
      ],
    },
    {
      heading: "Two halal cafés in Luton",
      paragraphs: [
        "Find us at Luton Crown Court, 7–9 George Street, LU1 2AA, or Futures House, The Moakes, Marsh Farm, LU3 3QB. Both cafés are open to local workers, residents and the wider public.",
        "Luton Crown Court opens Monday to Friday from 9am to 5pm. Futures House opens Monday to Friday from 9am to 5pm and at weekends from 10am to 6pm.",
      ],
    },
    {
      heading: "Order halal food in the way that suits your day",
      paragraphs: [
        "Order at the till if you are already there, or use the website to choose your Luton branch and order for dine-in or takeaway.",
        "The live menu is the best place to confirm what is being sold today. It also prevents an old social post, blog article or third-party menu from becoming an inaccurate promise about stock or price.",
      ],
    },
  ],
  faqs: [
    {
      question: "Is all food at Café 1 Luton halal?",
      answer:
        "Yes. Café 1’s stated food policy is that all food served is halal. Ask the team if you need to see or discuss current supplier information for a particular item.",
    },
    {
      question: "Does Café 1 serve halal breakfast and halal lunch?",
      answer:
        "Yes. The food offer runs from all-day breakfast and Desi breakfast to sandwiches, paninis, wraps, rolls, curries and other hot lunch choices, subject to availability.",
    },
    {
      question: "Are vegetarian items automatically halal?",
      answer:
        "Café 1’s food is halal, but vegetarian is a separate classification. Use the vegetarian labels for the main item and each modifier, and ask the team when an ingredient matters to you.",
    },
    {
      question: "Can members of the public visit Café 1?",
      answer:
        "Yes. Both Luton Crown Court and Futures House are open to the public. Crown Court visitors should allow time for the building’s normal entrance and security arrangements.",
    },
  ],
};
