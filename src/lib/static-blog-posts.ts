export type BlogPostRecord = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  body_md: string;
  author: string | null;
  tags: string[];
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const author = "Café 1 Luton team";
const published = true;

export const STATIC_BLOG_POSTS: BlogPostRecord[] = [
  {
    id: "local-cafe-1-luton",
    slug: "cafe-1-luton-two-locations",
    title: "Café 1 Luton: Two Local Cafés, One Warm Welcome",
    excerpt:
      "Meet Café 1 at Luton Crown Court and Futures House in Marsh Farm—two convenient places for halal breakfast, lunch and coffee.",
    cover_url: "/blog/cafe1-luton.jpg",
    author,
    tags: ["Café 1 Luton", "Luton", "Local café"],
    published,
    published_at: "2026-08-25T09:00:00.000Z",
    created_at: "2026-08-25T09:00:00.000Z",
    updated_at: "2026-08-25T09:00:00.000Z",
    body_md: `Café 1 is part of everyday life in Luton. Whether you are starting work, taking a lunch break, meeting a friend or simply looking for something freshly prepared, our aim is straightforward: serve welcoming food and drink without making your day complicated.

## Find your nearest Café 1 in Luton

We have two Luton branches. **Café 1 Luton Crown Court** is inside Luton Crown Court at 7–9 George Street, Luton, LU1 2AA, close to the town centre and open to the public. **Café 1 Futures House** is inside Futures House at The Moakes, Marsh Farm, LU3 3QB.

Both cafés serve dine-in and takeaway customers. Choose your branch on our [live menu](/menu), select dine-in or takeaway, and order for ASAP or a later collection time. We do not offer direct delivery from the Luton website.

## Breakfast, lunch and proper café favourites

Our menu brings together familiar British café food and Desi favourites. That means you can start with a halal breakfast, return for a comforting lunch, pick up a hot drink or choose one of the specials that regular customers look forward to.

The exact selection can change with the day and availability, which is why the live menu is the best place to see what is being served now. Favourites such as our cheese flan, chicken pie and Friday roast deserve their own stories—and you will find those guides in this journal.

## Two branches, the same Café 1 welcome

The locations are different, but our approach is the same: friendly service, useful choices and food that fits a real working day. Crown Court is open Monday to Friday from 9am to 5pm. Futures House is open Monday to Friday from 9am to 5pm and at weekends from 10am to 6pm.

For later orders, collection times begin 15 minutes after opening and finish 30 minutes before closing. Check the selected branch status before travelling, especially around bank holidays.

Ready to visit? [Choose your Luton branch and view today’s menu](/menu).`,
  },
  {
    id: "local-futures-house",
    slug: "cafe-1-futures-house-marsh-farm",
    title: "Café 1 Futures House: Breakfast and Lunch in Marsh Farm",
    excerpt:
      "A local guide to Café 1 inside Futures House, Marsh Farm, with opening hours, ordering choices and food for every part of the day.",
    cover_url: "/blog/futures-house-marsh-farm.jpg",
    author,
    tags: ["Futures House", "Marsh Farm", "Luton café"],
    published,
    published_at: "2026-08-24T09:00:00.000Z",
    created_at: "2026-08-24T09:00:00.000Z",
    updated_at: "2026-08-25T09:00:00.000Z",
    body_md: `Café 1 Futures House gives Marsh Farm a convenient place for breakfast, lunch, coffee and a relaxed catch-up. You will find us inside **Futures House, The Moakes, Luton LU3 3QB**.

## A café for Marsh Farm

Futures House is a community setting, so the café needs to work for different kinds of days. Some customers want a quick takeaway before their next appointment. Others have time to sit down over breakfast or lunch. We support both: choose **dine in** or **takeaway** when ordering.

## What can you order?

The menu combines British café classics, halal breakfast choices, hot lunches, lighter options and drinks. Availability can vary, particularly for freshly prepared specials, so [check the Futures House menu](/menu) before setting off.

If you are planning ahead, later collection slots start 15 minutes after the branch opens and finish 30 minutes before it closes. Notes and pre-orders are supported, making it easier to explain a simple preference or arrange food for later in the day.

## Who is the branch useful for?

Futures House works well for nearby residents, people using services in the building, local teams and anyone passing through Marsh Farm. Weekend opening also makes this branch different from Crown Court. It gives customers a Saturday or Sunday Café 1 option without travelling into the town centre, while weekday hours still cover breakfast, lunch and afternoon coffee.

## Futures House opening hours

- Monday to Friday: **9am–5pm**
- Saturday and Sunday: **10am–6pm**

The live branch status will show **Open** or **Closed now**. Bank-holiday arrangements can differ, so the website is the best place to check before travelling.

## Make Café 1 part of your day

Whether you live nearby, work in the area or are visiting Futures House, Café 1 offers a straightforward local choice: welcoming service, 100% halal food and options for breakfast through to late afternoon.

[Choose Futures House and see today’s menu](/menu), or [find the branch contact details](/contact).`,
  },
  {
    id: "local-luton-crown-court",
    slug: "cafe-1-luton-crown-court",
    title: "Café 1 at Luton Crown Court: Good Food in the Heart of Luton",
    excerpt:
      "Plan breakfast, coffee or lunch at Café 1 Luton Crown Court, open to the public Monday to Friday at 7–9 George Street.",
    cover_url: "/blog/luton-crown-court.jpg",
    author,
    tags: ["Luton Crown Court", "Luton town centre", "Lunch"],
    published,
    published_at: "2026-08-23T09:00:00.000Z",
    created_at: "2026-08-23T09:00:00.000Z",
    updated_at: "2026-08-25T09:00:00.000Z",
    body_md: `Café 1 Luton Crown Court is a town-centre café serving the public as well as people working in and visiting the court. Find us inside **Luton Crown Court, 7–9 George Street, Luton, LU1 2AA**.

## Open to the public

You do not need to be connected with the court to visit Café 1. If you are nearby and want breakfast, lunch, coffee or something to take away, you are welcome.

The branch is open **Monday to Friday, 9am–5pm**. The public website shows whether the café is **Open** or **Closed now**, helping you check before you travel.

## Food that fits a busy day

Town-centre days do not always run to schedule. Our dine-in and takeaway choices give you flexibility: sit down when time allows, or order ahead and collect. Later collection slots run from 15 minutes after opening until 30 minutes before closing.

Our 100% halal selection includes breakfast, hot lunches, café favourites and changing specials. The Friday roast, chicken pie and our well-known cheese flan are the kind of comforting dishes customers talk about, although availability can change and popular portions can sell out.

## Ordering from Crown Court

Start on the [Café 1 menu](/menu) and choose **Luton Crown Court** as the first step. Then choose dine in or takeaway and select ASAP or Later. Direct delivery is not offered through our Luton website.

The Crown Court kitchen also receives marketplace orders through Just Eat, Uber Eats and Deliveroo. Those services are separate from the public Café 1 website and their availability is controlled by each marketplace.

## Before you visit

Court and town-centre days can become busy without much warning. Check the branch status and current menu online before leaving, then use a Later collection time if you know when your break will begin. Ordering ahead cannot change an appointment or queue, but it can make the food part of your day more predictable.

If you are near central Luton, come in and make Café 1 part of your day. [View the live menu](/menu) or [see our contact page](/contact) for directions.`,
  },
  {
    id: "local-breakfast-luton",
    slug: "breakfast-in-luton-cafe-1",
    title: "Breakfast in Luton: Start the Day the Café 1 Way",
    excerpt:
      "From a quick morning bite to a filling cooked breakfast, discover dine-in and takeaway breakfast at both Café 1 Luton branches.",
    cover_url: "/blog/breakfast-in-luton.jpg",
    author,
    tags: ["Breakfast in Luton", "Halal breakfast", "Morning food"],
    published,
    published_at: "2026-08-22T09:00:00.000Z",
    created_at: "2026-08-22T09:00:00.000Z",
    updated_at: "2026-08-25T09:00:00.000Z",
    body_md: `A good breakfast should make the rest of the morning easier. At Café 1 Luton, you can choose a quick bite, a hot drink or a more filling cooked breakfast at Luton Crown Court or Futures House in Marsh Farm.

## What makes a useful café breakfast?

Different mornings call for different choices. You might want something substantial before a long day, something simple to take away, or time to sit with a coffee. A good local breakfast menu should offer that flexibility without turning the first decision of the day into a chore.

At Café 1, food is 100% halal and the menu brings familiar British breakfast ideas together with Desi flavours. Check the [live menu](/menu) for today’s exact dishes, prices and availability rather than relying on an older post.

## Dine in or take away

Choose your branch first, then select **dine in** or **takeaway**. If you are already nearby, order ASAP. If you know when your break or appointment will be, select a Later time. Later slots begin 15 minutes after opening and end 30 minutes before closing.

This works particularly well for busy weekdays at Crown Court and for both weekdays and weekends at Futures House.

## Build the breakfast that suits your morning

Breakfast is personal. One customer may want a full, hot plate and another may only have time for toast and a drink. Rather than guessing from a photo, open the branch menu and compare the current choices. You can add the items that suit your appetite and use an order note for a straightforward request the kitchen needs to see.

## Where to find breakfast in Luton

- **Luton Crown Court:** 7–9 George Street, Luton, LU1 2AA; open to the public Monday to Friday, 9am–5pm.
- **Futures House:** The Moakes, Marsh Farm, LU3 3QB; Monday to Friday, 9am–5pm and weekends, 10am–6pm.

Breakfast availability may change as the day moves on, so an earlier visit gives you the widest choice. The branch status on the website will say **Open** or **Closed now**.

For more detail, read our [halal breakfast guide](/blog/halal-breakfast-luton) or [choose your branch and order](/menu).`,
  },
  {
    id: "local-halal-breakfast-luton",
    slug: "halal-breakfast-luton",
    title: "Halal Breakfast in Luton: A Local Café 1 Guide",
    excerpt:
      "Looking for a halal breakfast in Luton? Café 1 serves a 100% halal menu at Crown Court and Futures House in Marsh Farm.",
    cover_url: "/blog/halal-breakfast-in-luton.jpg",
    author,
    tags: ["Halal breakfast Luton", "100% halal", "Café breakfast"],
    published,
    published_at: "2026-08-21T09:00:00.000Z",
    created_at: "2026-08-21T09:00:00.000Z",
    updated_at: "2026-08-25T09:00:00.000Z",
    body_md: `When you are searching for a halal breakfast in Luton, certainty matters. Café 1’s food menu is **100% halal**, so customers can choose breakfast without having to separate halal and non-halal food sections.

## Halal breakfast with familiar choices

A café breakfast can be traditional, light, spicy or somewhere in between. Café 1 brings together the comfort of British breakfast food and the flavour of Desi breakfast choices. That makes it useful for families, workers and visitors who want choice while keeping the whole food menu halal.

The live menu is the reliable place to confirm today’s dishes. Ingredients and availability can change, and freshly prepared items may sell out, so we avoid promising that every item will be available every day.

## Two places for halal breakfast in Luton

Visit **Café 1 Luton Crown Court** at 7–9 George Street during the working week, or **Café 1 Futures House** at The Moakes in Marsh Farm on weekdays and weekends. Both branches are open to the public.

- Crown Court: Monday to Friday, 9am–5pm.
- Futures House: Monday to Friday, 9am–5pm; Saturday and Sunday, 10am–6pm.

Both branches welcome dine-in and takeaway orders. Direct delivery is not available through cafe1luton.co.uk.

## Clear information builds confidence

Customers should not have to rely on vague wording when choosing halal food. Our website states the position clearly and keeps the latest menu attached to the branch you select. If you have a specific allergy or ingredient question as well as a halal requirement, speak to the team before ordering so the kitchen can give you the most useful current information.

## Order at the time that suits you

Choose ASAP when the branch is open, or select a Later collection time. Later ordering begins 15 minutes after the branch opens and ends 30 minutes before closing. This helps the kitchen prepare orders within the hours that location is serving.

If the website says **Closed now**, select another available day or return when the branch is open. Bank-holiday hours may differ.

[See today’s halal breakfast choices](/menu) or explore our broader [breakfast in Luton guide](/breakfast-luton).`,
  },
  {
    id: "local-cheese-flan-luton",
    slug: "cafe-1-famous-cheese-flan-luton",
    title: "Why Café 1’s Famous Cheese Flan Is a Luton Favourite",
    excerpt:
      "Simple, comforting and satisfying: discover why Café 1’s famous cheese flan has become a lunchtime favourite in Luton.",
    cover_url: "/blog/cheese-flan-luton.jpg",
    author,
    tags: ["Cheese flan", "Café 1 favourite", "Luton lunch"],
    published,
    published_at: "2026-08-20T09:00:00.000Z",
    created_at: "2026-08-20T09:00:00.000Z",
    updated_at: "2026-08-25T09:00:00.000Z",
    body_md: `Some café dishes earn a following because they are clever. Others become favourites because they are exactly what people want: warm, familiar and satisfying. Café 1’s **famous cheese flan** belongs in the second group.

## A proper café classic

Cheese flan has the comfort of a traditional British lunch. The rich savoury filling and pastry make it filling without being complicated, and it works naturally with familiar café sides. It is the kind of dish that regular customers remember and ask for again.

At Café 1, the appeal is also about the setting. A hot, comforting lunch can be just what you need between appointments, during a work break or on a cooler Luton day.

## Where can you try it?

Look for cheese flan at our Luton Crown Court and Futures House branches. Because food is prepared for real daily service, availability can vary and popular portions can sell out. Check the [live Café 1 menu](/menu) and select your branch to see what is available today.

You can dine in or choose takeaway. For a planned lunch break, use Later ordering; collection slots start 15 minutes after opening and stop 30 minutes before closing.

## Make it part of lunch

The best accompaniments are a matter of taste. Some customers want a classic hot lunch plate, while others keep it simple. The current menu will show the sides and extras available at your selected branch.

What makes the cheese flan special is not hype. It is a dependable Café 1 favourite: straightforward food, served warmly, that has earned its place in the Luton lunch conversation.

## Why simple favourites last

Food trends come and go, but familiar dishes stay popular when they deliver the same kind of comfort people remember. Cheese flan crosses generations: some customers know it from school or traditional cafés, while others discover it at Café 1 for the first time. That shared recognition is part of why a simple lunch can become a local talking point.

[Check whether cheese flan is on today’s menu](/menu), and share this page with someone who already knows why it is famous.`,
  },
  {
    id: "local-friday-roast-luton",
    slug: "friday-roast-special-luton",
    title: "Friday Roast Special in Luton: Make Friday Roast Day",
    excerpt:
      "End the working week with Café 1’s Friday roast special—a comforting hot lunch available while portions last.",
    cover_url: "/blog/friday-roast-special-luton.jpg",
    author,
    tags: ["Friday roast", "Friday special", "Luton lunch"],
    published,
    published_at: "2026-08-19T09:00:00.000Z",
    created_at: "2026-08-19T09:00:00.000Z",
    updated_at: "2026-08-25T09:00:00.000Z",
    body_md: `Friday lunch should feel like the week has turned a corner. Café 1’s **Friday roast special** brings the comfort of a roast dinner into the working day, without waiting until Sunday.

## Why Friday works for a roast

By the end of the week, a cold snack does not always feel enough. A hot roast-style lunch gives you something more substantial and makes an ordinary Friday break feel like an occasion.

The special is freshly prepared and portions are finite. That is good for quality, but it also means the roast may sell out. Check your branch on the [live menu](/menu) and order earlier if the Friday special is the reason for your visit.

## Dine in or take it away

If you have time, sit down and enjoy the break. If the day is busy, select takeaway and choose a suitable collection time. Later slots begin 15 minutes after opening and finish 30 minutes before closing.

The Friday roast is most relevant to our weekday service at **Luton Crown Court** and **Futures House**. Both branches open from 9am to 5pm Monday to Friday.

## Planning a Friday lunch together

The roast is an easy reason to bring colleagues, friends or family together at the end of the week. If several people want to eat at the same time, agree on the branch and collection plan first. Each person can check the current menu, while an early pre-order helps avoid leaving the decision until the busiest part of lunch service.

## A weekly Café 1 tradition

Specials give regular customers something different to look forward to while keeping the everyday menu familiar. The Friday roast is a simple idea done for the right reason: a warming, filling lunch to finish the working week.

Exact ingredients, sides and availability can change, so the live menu is always more reliable than an older social post. If the roast is listed, choose your branch, select dine in or takeaway, and order for ASAP or Later.

[See today’s Friday menu](/menu) and share this guide with the person who should join you for roast day.`,
  },
  {
    id: "local-chicken-pie-luton",
    slug: "chicken-pie-lunch-luton",
    title: "Chicken Pie for Lunch in Luton: A Café 1 Classic",
    excerpt:
      "Warm, filling and familiar, chicken pie is one of the comforting lunch choices customers look for at Café 1 Luton.",
    cover_url: "/blog/chicken-pie-luton.jpg",
    author,
    tags: ["Chicken pie", "Hot lunch", "Luton café"],
    published,
    published_at: "2026-08-18T09:00:00.000Z",
    created_at: "2026-08-18T09:00:00.000Z",
    updated_at: "2026-08-25T09:00:00.000Z",
    body_md: `Chicken pie is one of those lunches that does not need a long explanation. It is warm, familiar and filling—the sort of café classic that suits a proper break in the middle of a busy Luton day.

## Comfort food for a working lunch

The appeal of pie is balance: pastry, savoury filling and the chance to pair it with the sides you enjoy. It feels more complete than a quick snack, yet still works for an everyday lunch.

At Café 1, chicken pie sits naturally alongside the British classics and Desi favourites that give our menu its range. Our food is 100% halal, and the live menu shows the current choices for each location.

## Choose your Luton branch

Visit Café 1 inside **Luton Crown Court at 7–9 George Street, Luton, LU1 2AA**, or at **Futures House** in Marsh Farm. Both locations are open to the public. Select the branch first when ordering because availability can differ between kitchens.

Both cafés offer dine in and takeaway. If you know the time of your lunch break, choose a Later slot. If you are ready to collect and the café is open, choose ASAP. The website will clearly show **Open** or **Closed now** for the selected location.

## What makes a satisfying pie lunch?

It is not only the pie itself. Temperature, sides, portion and the time you have available all matter. Ordering from the live branch menu lets you see the complete current choices instead of building a lunch around an item or side that has sold out. For dine-in customers, a hot drink can turn a quick meal into a proper pause.

## Check today’s menu

Fresh food and changing specials mean chicken pie may not be available at every moment. Checking online before you travel prevents disappointment and gives you time to choose another Café 1 favourite if it has sold out.

Whether you are after chicken pie, cheese flan, the Friday roast or something lighter, Café 1 is here to make a Luton lunch break feel worthwhile.

[Choose your branch and view today’s lunch menu](/menu).`,
  },
  {
    id: "local-lunch-luton",
    slug: "lunch-in-luton-cafe-1-guide",
    title: "Lunch in Luton: A Better Break at Café 1",
    excerpt:
      "Plan a satisfying halal lunch in Luton with British café classics, Desi favourites and weekly specials at two Café 1 branches.",
    cover_url: "/blog/lunch-in-luton.jpg",
    author,
    tags: ["Lunch in Luton", "Halal lunch", "Café 1"],
    published,
    published_at: "2026-08-17T09:00:00.000Z",
    created_at: "2026-08-17T09:00:00.000Z",
    updated_at: "2026-08-25T09:00:00.000Z",
    body_md: `A lunch break is not only about eating. It is a pause in the day, and the right local café can make a short break feel more useful. Café 1 offers 100% halal lunch choices at two Luton locations, with dine-in and takeaway ordering.

## British classics, Desi favourites and changing specials

Choice matters because not every day calls for the same lunch. Sometimes you want a familiar café classic such as cheese flan or chicken pie. On Friday, the roast special may be the main event. On another day, a Desi favourite or a lighter option may suit you better.

The menu changes with availability, so [today’s live menu](/menu) is the best source for current dishes and prices.

## Lunch near central Luton

**Café 1 Luton Crown Court** is inside Luton Crown Court at 7–9 George Street, Luton, LU1 2AA. It is open to the public Monday to Friday from 9am to 5pm, making it a convenient town-centre choice for workers and visitors.

## Lunch in Marsh Farm

**Café 1 Futures House** is inside Futures House at The Moakes, LU3 3QB. It opens Monday to Friday from 9am to 5pm and Saturday to Sunday from 10am to 6pm, giving Marsh Farm a Café 1 option throughout the week.

## Plan the break, not the queue

Choose dine in when you want to sit down, or takeaway when you need to keep moving. ASAP and Later ordering are available while the selected branch is serving. Later collection slots start 15 minutes after opening and end 30 minutes before closing.

The Luton branches do not offer direct website delivery. Crown Court marketplace availability on Just Eat, Uber Eats or Deliveroo is separate and may change on those platforms.

For a warmer, more satisfying Luton lunch break, [choose your Café 1 branch](/menu) and see what is cooking today.`,
  },
];

export type BlogPostSummary = Omit<BlogPostRecord, "body_md" | "published">;

export const STATIC_BLOG_POST_SUMMARIES: BlogPostSummary[] = STATIC_BLOG_POSTS.map(
  ({ body_md: _body, published: _published, ...post }) => post,
);

export function getStaticBlogPost(slug: string): BlogPostRecord | null {
  return STATIC_BLOG_POSTS.find((post) => post.slug === slug) ?? null;
}

export function mergeBlogPostSummaries(remotePosts: BlogPostSummary[]): BlogPostSummary[] {
  const posts = new Map(STATIC_BLOG_POST_SUMMARIES.map((post) => [post.slug, post]));
  for (const post of remotePosts) {
    if (!posts.has(post.slug)) posts.set(post.slug, post);
  }
  return [...posts.values()].sort((a, b) => {
    const aDate = a.published_at ?? a.created_at;
    const bDate = b.published_at ?? b.created_at;
    return bDate.localeCompare(aDate);
  });
}
