import type { LocalSearchPageConfig } from "@/components/local-search-page";

const path = "/lunch-luton";

export const config: LocalSearchPageConfig = {
  path,
  eyebrow: "Lunch in Luton",
  title: "A Luton lunch for quick breaks and hungry afternoons.",
  intro:
    "Choose a hot meal, sandwich, panini, wrap, salad or all-day breakfast from our halal menu at Luton Crown Court or Futures House in Marsh Farm.",
  imageAlt:
    "Café 1 Luton lunch spread with fish and chips, jacket potato, breakfast and loaded fries",
  highlights: [
    {
      title: "Hot lunches",
      text: "The menu includes choices such as chicken curry with rice, lamb curry with rice, fish and chips and rotating Cafe 1 Classics.",
    },
    {
      title: "Sandwiches and paninis",
      text: "Choose a cold filled sandwich or a hot pressed panini when you want lunch that is easy to take back to work.",
    },
    {
      title: "Wraps, rolls and salads",
      text: "Choose a wrap or filled roll, or look for lighter salad and cold-food options on the live menu.",
    },
    {
      title: "Breakfast for lunch",
      text: "Our breakfast and Desi breakfast categories are served all day, so lunch does not have to mean giving up your favourite morning plate.",
    },
  ],
  sections: [
    {
      heading: "Lunch that fits the time you actually have",
      paragraphs: [
        "Some days allow a proper sit-down break; others leave enough time only to collect a prepared order. Café 1 supports both. Dine in at the café, order at the counter to take away, or place the order online before you arrive.",
        "The range covers filling hot meals and compact desk-friendly choices. Availability can change during service, so use the live menu to make the final choice rather than relying on a saved menu image.",
      ],
      bullets: [
        "Order online for collection before leaving the office",
        "Choose Luton Crown Court or Futures House before ordering",
        "Dine in or order a takeaway online",
        "All food served at Café 1 is halal",
      ],
    },
    {
      heading: "Lunch near Luton Crown Court",
      paragraphs: [
        "The café is inside Luton Crown Court at 7–9 George Street, LU1 2AA. It serves jurors, court users and staff, but it is also open to local workers, residents and other members of the public.",
        "If you are visiting the court, the café gives you a food option without leaving the building. If you are coming from outside, check the contact page for directions and allow for the courthouse’s normal visitor and security procedures.",
      ],
    },
    {
      heading: "Lunch at Futures House, Marsh Farm",
      paragraphs: [
        "Our second Luton café is inside Futures House, The Moakes, Marsh Farm, LU3 3QB. It is open to the community and gives north Luton another place to enjoy the Café 1 menu.",
        "Choose Futures House when opening the menu, then select dine-in or takeaway and the time you want your food prepared.",
      ],
    },
  ],
  faqs: [
    {
      question: "Where can I get lunch near Luton Crown Court?",
      answer:
        "Café 1 is located inside Luton Crown Court at LU1 2AA and is open to the public. You can also visit Café 1 at Futures House in Marsh Farm, LU3 3QB.",
    },
    {
      question: "What lunch food does Café 1 serve?",
      answer:
        "The menu includes hot specials, curries with rice, fish and chips, sandwiches, paninis, wraps, rolls, salads and all-day breakfast. Check the live menu for current availability and prices.",
    },
    {
      question: "Can I order lunch for collection?",
      answer:
        "Yes. Choose collection when ordering online, or order at the counter for takeaway. The website will show the available order times.",
    },
    {
      question: "Can I order lunch online for takeaway?",
      answer:
        "Yes. Choose Luton Crown Court or Futures House, select takeaway and pick an available preparation time before checkout.",
    },
  ],
};
