import type { LocalSearchPageConfig } from "@/components/local-search-page";

const path = "/breakfast-luton";

export const config: LocalSearchPageConfig = {
  path,
  eyebrow: "Breakfast in Luton",
  title: "A proper halal breakfast in Luton—served all day.",
  intro:
    "Start with a cooked breakfast, a Desi favourite, a fresh omelette or something quick with coffee. Visit Café 1 at Luton Crown Court or Futures House in Marsh Farm.",
  imageAlt:
    "Café 1 breakfast and lunch spread including a cooked breakfast, hot meal and loaded fries",
  highlights: [
    {
      title: "Cooked breakfast plates",
      text: "Choose a filling breakfast plate with familiar favourites including eggs, toast, beans and hash browns. Check the live menu for today’s full combinations.",
    },
    {
      title: "Desi breakfast",
      text: "Paratha, Desi omelette and chana can be ordered separately or together for a warm, savoury start to the day.",
    },
    {
      title: "Omelettes made to order",
      text: "Plain, cheese and onion, cheese and tomato, chicken and cheese, and Desi-style choices are listed on the menu.",
    },
    {
      title: "Quick breakfast and coffee",
      text: "If time is short, order online for collection or choose a smaller breakfast, toast, pastry or hot drink at the counter.",
    },
  ],
  sections: [
    {
      heading: "Breakfast that does not stop at a morning deadline",
      paragraphs: [
        "Our breakfast menu is served all day during normal weekday opening hours. That makes Café 1 useful whether you are heading into work early, taking a break between appointments or want breakfast food at lunchtime.",
        "The live menu shows current availability, prices, vegetarian labels and any choices you need to make. If a dietary tag or ingredient is important to you, speak to the team before ordering so we can give you the most current information.",
      ],
      bullets: [
        "Breakfast service from 9am",
        "All food served at Café 1 is halal",
        "Vegetarian choices are clearly separated from meat add-ons",
        "Order at the counter or online for collection, takeaway or dine-in",
      ],
    },
    {
      heading: "Two easy Luton locations",
      paragraphs: [
        "Café 1 is inside Luton Crown Court at 7–9 George Street, LU1 2AA, and at Futures House, The Moakes, Marsh Farm, LU3 3QB. Both cafés are open to the public.",
        "Allow time for normal entrance and security arrangements at Crown Court. Our contact page shows both addresses, opening times, maps and directions.",
      ],
    },
    {
      heading: "Breakfast for the table, the desk or the journey",
      paragraphs: [
        "Choose your Luton branch first, then dine in, take your order away or place a takeaway order online before you arrive.",
        "For the quickest choice, browse the menu before you set off. Online availability reflects the café’s current menu more reliably than an old photo or third-party listing.",
      ],
    },
  ],
  faqs: [
    {
      question: "What time does breakfast start at Café 1 Luton?",
      answer:
        "Breakfast starts when each café opens at 9am. Luton Crown Court opens Monday to Friday; Futures House also opens at weekends from 10am.",
    },
    {
      question: "Is the breakfast at Café 1 halal?",
      answer:
        "Yes. All food served at Café 1 is halal. If you need supplier, ingredient or allergen details, ask the team before ordering so they can check the current product information.",
    },
    {
      question: "Can I order breakfast after the morning?",
      answer:
        "Yes. The breakfast and Desi breakfast categories are served all day during normal opening hours, subject to current availability.",
    },
    {
      question: "Can I order breakfast for takeaway in Luton?",
      answer:
        "Yes. Choose Luton Crown Court or Futures House when opening the menu, then select takeaway and your preferred collection time.",
    },
  ],
};
