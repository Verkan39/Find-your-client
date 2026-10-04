/**
 * Category knowledge base. Each entry encodes what a freelance developer needs to know
 * about a type of local business: how to find it on OpenStreetMap, what it typically
 * earns (US-market baseline, scaled per country elsewhere), who its customers are,
 * how dependent it is on digital channels, and which services fit it best.
 */

export type ServiceKey =
  | "website"
  | "redesign"
  | "booking"
  | "ordering"
  | "ecommerce"
  | "localSeo"
  | "performance"
  | "analytics"
  | "social"
  | "whatsapp"
  | "reviews"
  | "crm"
  | "listings"
  | "portal";

export interface CategoryDef {
  key: string;
  label: string;
  group: Group;
  /** OSM tag matches, e.g. ["amenity=restaurant"]. */
  osm: string[];
  /** Annual revenue range for a typical small independent in the US, USD. */
  revenueUSD: [number, number];
  /** 0-1: how much new customers come through digital discovery. */
  digitalDependency: number;
  /** 0-1: typical willingness/ability to spend on tech. */
  spendPropensity: number;
  /** Customer-facing booking/ordering is core to the business model. */
  transactional: "booking" | "ordering" | "ecommerce" | "inquiry";
  customers: { name: string; description: string; share: number }[];
  journey: string;
  /** Services ranked by fit for this category. */
  services: ServiceKey[];
  decisionMaker: string;
  timing: string;
}

export type Group =
  | "Food & Drink"
  | "Health"
  | "Beauty & Fitness"
  | "Retail"
  | "Professional"
  | "Auto"
  | "Hospitality"
  | "Education"
  | "Home Services";

export const GROUPS: Group[] = [
  "Food & Drink",
  "Health",
  "Beauty & Fitness",
  "Retail",
  "Professional",
  "Hospitality",
  "Education",
  "Auto",
  "Home Services",
];

const owner = "Owner / founder (usually the person at the counter or answering the phone)";

export const CATEGORIES: CategoryDef[] = [
  /* ------------------------------ Food & Drink ------------------------------ */
  {
    key: "restaurant", label: "Restaurant", group: "Food & Drink", osm: ["amenity=restaurant"],
    revenueUSD: [350_000, 1_400_000], digitalDependency: 0.85, spendPropensity: 0.55, transactional: "ordering",
    customers: [
      { name: "Local families", description: "Weekend and celebration dining within a few km", share: 35 },
      { name: "Young professionals", description: "After-work meals and dates, discover via Instagram and maps", share: 30 },
      { name: "Delivery customers", description: "Order through aggregator apps, price and rating sensitive", share: 25 },
      { name: "Tourists & visitors", description: "Choose from map ratings and review photos", share: 10 },
    ],
    journey: "Searches 'restaurants near me' or scrolls Instagram, compares ratings, photos and menu prices, then walks in, books, or orders on a delivery app.",
    services: ["ordering", "localSeo", "website", "reviews", "social", "booking", "crm"],
    decisionMaker: "Owner or managing partner; in larger places the operations manager", timing: "Mid-afternoon (3-5pm) between lunch and dinner service; avoid Fri-Sun",
  },
  {
    key: "cafe", label: "Café", group: "Food & Drink", osm: ["amenity=cafe"],
    revenueUSD: [180_000, 650_000], digitalDependency: 0.8, spendPropensity: 0.5, transactional: "ordering",
    customers: [
      { name: "Students & remote workers", description: "Long stays, wifi seekers, loyal if the vibe fits", share: 35 },
      { name: "Office commuters", description: "Quick morning coffee, value speed and pre-ordering", share: 30 },
      { name: "Social media explorers", description: "Visit for aesthetic spots and signature drinks", share: 25 },
      { name: "Neighbourhood regulars", description: "Daily habit, respond to loyalty offers", share: 10 },
    ],
    journey: "Discovers through Instagram reels or maps, checks photos and vibe, visits, and becomes a regular if there's a loyalty hook.",
    services: ["social", "ordering", "crm", "localSeo", "website", "reviews"],
    decisionMaker: owner, timing: "Mid-morning after the rush (10-11:30am) on weekdays",
  },
  {
    key: "fast_food", label: "Quick Service", group: "Food & Drink", osm: ["amenity=fast_food", "amenity=food_court"],
    revenueUSD: [250_000, 900_000], digitalDependency: 0.75, spendPropensity: 0.45, transactional: "ordering",
    customers: [
      { name: "Delivery app users", description: "Order via aggregators, price driven", share: 45 },
      { name: "Students", description: "Budget-conscious, high frequency", share: 30 },
      { name: "Walk-in workers", description: "Lunch-hour, speed matters most", share: 25 },
    ],
    journey: "Finds them on a delivery app or walking past; repeat orders depend on ratings and offers.",
    services: ["ordering", "whatsapp", "localSeo", "crm", "website"],
    decisionMaker: owner, timing: "3-5pm weekdays",
  },
  {
    key: "bar", label: "Bar / Pub", group: "Food & Drink", osm: ["amenity=bar", "amenity=pub", "amenity=nightclub"],
    revenueUSD: [300_000, 1_200_000], digitalDependency: 0.7, spendPropensity: 0.55, transactional: "booking",
    customers: [
      { name: "Young adults (21-35)", description: "Weekend nights, events and offers drive visits", share: 55 },
      { name: "Groups & parties", description: "Birthdays and corporate outings, need table reservations", share: 30 },
      { name: "Sports & event fans", description: "Come for screenings and live music", share: 15 },
    ],
    journey: "Sees an event on Instagram or hears from friends, checks the vibe and offers, reserves a table for groups.",
    services: ["booking", "social", "website", "crm", "localSeo"],
    decisionMaker: "Owner or general manager", timing: "Early afternoon on Tue-Thu",
  },
  {
    key: "bakery", label: "Bakery / Desserts", group: "Food & Drink", osm: ["shop=bakery", "shop=pastry", "shop=confectionery", "amenity=ice_cream"],
    revenueUSD: [150_000, 600_000], digitalDependency: 0.7, spendPropensity: 0.45, transactional: "ordering",
    customers: [
      { name: "Celebration buyers", description: "Custom cakes for birthdays and weddings, order days ahead", share: 40 },
      { name: "Daily walk-ins", description: "Neighbourhood customers buying bread and snacks", share: 40 },
      { name: "Corporate & bulk orders", description: "Offices and events", share: 20 },
    ],
    journey: "Searches for custom cakes, browses photos on Instagram, then calls or WhatsApps to place an order.",
    services: ["ordering", "ecommerce", "social", "whatsapp", "localSeo", "website"],
    decisionMaker: owner, timing: "Early afternoon weekdays",
  },

  /* ---------------------------------- Health --------------------------------- */
  {
    key: "dentist", label: "Dental Clinic", group: "Health", osm: ["amenity=dentist", "healthcare=dentist"],
    revenueUSD: [600_000, 1_800_000], digitalDependency: 0.8, spendPropensity: 0.8, transactional: "booking",
    customers: [
      { name: "Families", description: "Routine check-ups and kids' dentistry, value trust and proximity", share: 40 },
      { name: "Cosmetic patients", description: "Whitening, aligners, implants; high ticket, research heavily online", share: 30 },
      { name: "Emergency patients", description: "Search 'dentist near me open now', convert fast", share: 30 },
    ],
    journey: "Searches 'dentist near me', reads reviews, checks treatments and prices on the site, then calls or books online.",
    services: ["booking", "localSeo", "redesign", "reviews", "portal", "analytics", "website"],
    decisionMaker: "Lead dentist / practice owner; sometimes the practice manager", timing: "Lunch break (1-2pm) or after clinic hours",
  },
  {
    key: "clinic", label: "Clinic / Doctor", group: "Health", osm: ["amenity=clinic", "amenity=doctors", "healthcare=doctor", "healthcare=clinic"],
    revenueUSD: [500_000, 2_000_000], digitalDependency: 0.7, spendPropensity: 0.75, transactional: "booking",
    customers: [
      { name: "Local residents", description: "General consultations, choose by proximity and reputation", share: 50 },
      { name: "Chronic-care patients", description: "Recurring visits, value reminders and records", share: 30 },
      { name: "Specialist seekers", description: "Research the doctor's credentials online", share: 20 },
    ],
    journey: "Gets a referral or searches by specialty, checks doctor credentials and reviews, then phones for an appointment.",
    services: ["booking", "portal", "localSeo", "website", "reviews", "whatsapp"],
    decisionMaker: "Senior doctor / clinic owner", timing: "After evening OPD or on Sunday mornings",
  },
  {
    key: "physio", label: "Physio / Therapy", group: "Health", osm: ["healthcare=physiotherapist", "healthcare=psychotherapist", "healthcare=alternative"],
    revenueUSD: [200_000, 700_000], digitalDependency: 0.75, spendPropensity: 0.65, transactional: "booking",
    customers: [
      { name: "Post-injury patients", description: "Referred by doctors, multi-session plans", share: 45 },
      { name: "Athletes & active adults", description: "Sports rehab, find via search and gyms", share: 30 },
      { name: "Seniors", description: "Mobility care, families often book", share: 25 },
    ],
    journey: "Referred by a doctor or searches the condition, compares clinics, books a first session.",
    services: ["booking", "website", "localSeo", "crm", "reviews"],
    decisionMaker: owner, timing: "Between sessions, early afternoon",
  },
  {
    key: "pharmacy", label: "Pharmacy", group: "Health", osm: ["amenity=pharmacy", "shop=chemist"],
    revenueUSD: [800_000, 3_000_000], digitalDependency: 0.5, spendPropensity: 0.5, transactional: "ordering",
    customers: [
      { name: "Chronic prescription buyers", description: "Monthly refills, value home delivery and reminders", share: 45 },
      { name: "Walk-in neighbours", description: "OTC and urgent needs", share: 40 },
      { name: "Wellness shoppers", description: "Personal care and supplements", share: 15 },
    ],
    journey: "Goes to the nearest trusted pharmacy; stays loyal if refills are easy to order by phone or WhatsApp.",
    services: ["whatsapp", "ordering", "crm", "localSeo", "website"],
    decisionMaker: "Owner pharmacist", timing: "Weekday afternoons",
  },
  {
    key: "optician", label: "Optician", group: "Health", osm: ["shop=optician", "healthcare=optometrist"],
    revenueUSD: [300_000, 900_000], digitalDependency: 0.6, spendPropensity: 0.6, transactional: "booking",
    customers: [
      { name: "Eye-test seekers", description: "Book a test, then buy frames", share: 50 },
      { name: "Fashion eyewear buyers", description: "Browse frames online first", share: 30 },
      { name: "Contact lens subscribers", description: "Recurring orders", share: 20 },
    ],
    journey: "Searches for eye tests nearby, compares frame selection and prices, visits for a test.",
    services: ["booking", "ecommerce", "localSeo", "crm", "website"],
    decisionMaker: owner, timing: "Weekday afternoons",
  },
  {
    key: "veterinary", label: "Veterinary", group: "Health", osm: ["amenity=veterinary"],
    revenueUSD: [500_000, 1_500_000], digitalDependency: 0.75, spendPropensity: 0.7, transactional: "booking",
    customers: [
      { name: "Dog & cat owners", description: "Vaccinations and check-ups, extremely review-driven", share: 70 },
      { name: "Emergency visits", description: "Urgent searches, convert immediately", share: 20 },
      { name: "Exotic pet owners", description: "Seek specialists, travel further", share: 10 },
    ],
    journey: "Asks pet-owner groups or searches maps, reads reviews about care quality, calls to book.",
    services: ["booking", "crm", "localSeo", "reviews", "website", "whatsapp"],
    decisionMaker: "Lead vet / owner", timing: "Early afternoon",
  },

  /* ----------------------------- Beauty & Fitness ---------------------------- */
  {
    key: "salon", label: "Hair Salon / Barber", group: "Beauty & Fitness", osm: ["shop=hairdresser", "shop=barber"],
    revenueUSD: [150_000, 550_000], digitalDependency: 0.8, spendPropensity: 0.5, transactional: "booking",
    customers: [
      { name: "Regular clients", description: "Visit every 3-6 weeks, loyal to a stylist", share: 50 },
      { name: "Style seekers", description: "Discover via Instagram transformations", share: 30 },
      { name: "Event clients", description: "Weddings and parties, higher ticket", share: 20 },
    ],
    journey: "Sees work on Instagram or maps photos, checks prices, books via call/DM; repeat visits depend on easy rebooking.",
    services: ["booking", "social", "crm", "localSeo", "reviews", "website"],
    decisionMaker: owner, timing: "Tuesday-Wednesday mornings (slowest days)",
  },
  {
    key: "beauty", label: "Beauty / Spa", group: "Beauty & Fitness", osm: ["shop=beauty", "leisure=spa", "shop=cosmetics", "shop=massage", "shop=tattoo"],
    revenueUSD: [180_000, 700_000], digitalDependency: 0.85, spendPropensity: 0.55, transactional: "booking",
    customers: [
      { name: "Self-care regulars", description: "Monthly treatments, respond to memberships", share: 45 },
      { name: "Bridal & event clients", description: "High-ticket packages, research portfolios", share: 30 },
      { name: "Gift & occasion buyers", description: "Vouchers and couple packages", share: 25 },
    ],
    journey: "Discovers through Instagram, reads reviews, compares packages, books by DM or phone.",
    services: ["booking", "social", "ecommerce", "crm", "reviews", "website"],
    decisionMaker: owner, timing: "Weekday mornings",
  },
  {
    key: "gym", label: "Gym / Studio", group: "Beauty & Fitness", osm: ["leisure=fitness_centre", "sport=yoga", "amenity=dojo", "leisure=dance"],
    revenueUSD: [250_000, 1_200_000], digitalDependency: 0.8, spendPropensity: 0.6, transactional: "booking",
    customers: [
      { name: "Fitness beginners (20-35)", description: "Join for transformation, need motivation and structure", share: 45 },
      { name: "Committed regulars", description: "Value classes, trainers and community", share: 35 },
      { name: "Corporate & seasonal joiners", description: "New-year and pre-wedding spikes", share: 20 },
    ],
    journey: "Searches gyms nearby, compares membership price and facilities, takes a trial, joins if follow-up is good.",
    services: ["crm", "booking", "website", "social", "portal", "localSeo"],
    decisionMaker: "Owner or head trainer", timing: "Late morning (10am-12pm) after the morning rush",
  },

  /* --------------------------------- Retail ---------------------------------- */
  {
    key: "fashion", label: "Fashion & Apparel", group: "Retail", osm: ["shop=clothes", "shop=shoes", "shop=boutique", "shop=bag", "shop=fashion_accessories", "shop=bridal"],
    revenueUSD: [250_000, 900_000], digitalDependency: 0.75, spendPropensity: 0.55, transactional: "ecommerce",
    customers: [
      { name: "Trend-driven shoppers (18-35)", description: "Discover on Instagram, buy online and in store", share: 45 },
      { name: "Occasion shoppers", description: "Weddings and festivals, high basket size", share: 35 },
      { name: "Loyal locals", description: "Repeat buyers, respond to new-arrival messages", share: 20 },
    ],
    journey: "Sees products on Instagram, DMs for price and size, visits or buys if checkout is easy.",
    services: ["ecommerce", "social", "whatsapp", "crm", "localSeo", "website"],
    decisionMaker: owner, timing: "Weekday late mornings",
  },
  {
    key: "jewelry", label: "Jewellery", group: "Retail", osm: ["shop=jewelry", "shop=watches"],
    revenueUSD: [500_000, 2_500_000], digitalDependency: 0.6, spendPropensity: 0.7, transactional: "inquiry",
    customers: [
      { name: "Wedding buyers", description: "Very high ticket, research for weeks", share: 45 },
      { name: "Gift buyers", description: "Anniversaries and festivals", share: 35 },
      { name: "Investment buyers", description: "Gold/coins, price-sensitive", share: 20 },
    ],
    journey: "Researches designs online, compares trust signals, visits the store with a shortlist.",
    services: ["ecommerce", "website", "localSeo", "crm", "social", "whatsapp"],
    decisionMaker: "Owner (often a family business)", timing: "Weekday late mornings",
  },
  {
    key: "electronics", label: "Electronics & Mobile", group: "Retail", osm: ["shop=electronics", "shop=mobile_phone", "shop=computer", "shop=appliance"],
    revenueUSD: [400_000, 1_500_000], digitalDependency: 0.6, spendPropensity: 0.5, transactional: "ecommerce",
    customers: [
      { name: "Upgraders", description: "Compare prices online before buying", share: 45 },
      { name: "Repair customers", description: "Need quick trustworthy service", share: 35 },
      { name: "Small businesses", description: "Bulk and accessories", share: 20 },
    ],
    journey: "Compares prices online, then calls the shop for availability and the best deal.",
    services: ["ecommerce", "localSeo", "whatsapp", "booking", "website"],
    decisionMaker: owner, timing: "Weekday afternoons",
  },
  {
    key: "home_store", label: "Furniture & Home", group: "Retail", osm: ["shop=furniture", "shop=interior_decoration", "shop=houseware", "shop=kitchen", "shop=bed", "shop=lighting"],
    revenueUSD: [500_000, 2_000_000], digitalDependency: 0.65, spendPropensity: 0.6, transactional: "inquiry",
    customers: [
      { name: "New homeowners", description: "Furnish whole rooms, long research", share: 50 },
      { name: "Renovators", description: "Specific pieces, style-driven", share: 30 },
      { name: "Interior designers & offices", description: "B2B bulk orders", share: 20 },
    ],
    journey: "Browses Pinterest/Instagram for style, looks for catalogues with prices online, visits to see quality.",
    services: ["ecommerce", "website", "social", "localSeo", "crm"],
    decisionMaker: owner, timing: "Weekday mornings",
  },
  {
    key: "florist", label: "Florist & Gifts", group: "Retail", osm: ["shop=florist", "shop=gift", "shop=toys", "shop=stationery"],
    revenueUSD: [150_000, 500_000], digitalDependency: 0.75, spendPropensity: 0.45, transactional: "ecommerce",
    customers: [
      { name: "Occasion gifters", description: "Birthdays and anniversaries, order same-day", share: 55 },
      { name: "Event planners", description: "Weddings and corporate decor", share: 25 },
      { name: "Walk-ins", description: "Impulse purchases", share: 20 },
    ],
    journey: "Searches 'flower delivery near me', needs to see arrangements and prices and order instantly.",
    services: ["ecommerce", "whatsapp", "localSeo", "social", "website"],
    decisionMaker: owner, timing: "Weekday mornings, avoid festival weeks",
  },
  {
    key: "books", label: "Books & Hobby", group: "Retail", osm: ["shop=books", "shop=music", "shop=art", "shop=craft", "shop=sports", "shop=bicycle", "shop=outdoor"],
    revenueUSD: [150_000, 600_000], digitalDependency: 0.55, spendPropensity: 0.4, transactional: "ecommerce",
    customers: [
      { name: "Enthusiasts", description: "Niche hobbyists, loyal to expert shops", share: 50 },
      { name: "Students & parents", description: "Seasonal school purchases", share: 30 },
      { name: "Gift buyers", description: "Occasional", share: 20 },
    ],
    journey: "Checks availability online, prefers a shop with expertise and community events.",
    services: ["ecommerce", "social", "crm", "localSeo", "website"],
    decisionMaker: owner, timing: "Weekday afternoons",
  },
  {
    key: "grocery", label: "Grocery & Convenience", group: "Retail", osm: ["shop=supermarket", "shop=convenience", "shop=greengrocer", "shop=butcher", "shop=deli", "shop=organic", "shop=health_food"],
    revenueUSD: [500_000, 2_500_000], digitalDependency: 0.45, spendPropensity: 0.4, transactional: "ordering",
    customers: [
      { name: "Neighbourhood households", description: "Weekly shop, value home delivery", share: 65 },
      { name: "Busy professionals", description: "Quick top-ups, order via phone", share: 25 },
      { name: "Specialty seekers", description: "Organic/imported items", share: 10 },
    ],
    journey: "Shops nearby by habit; switches to whoever makes ordering on WhatsApp or online easiest.",
    services: ["whatsapp", "ordering", "crm", "localSeo"],
    decisionMaker: owner, timing: "Early afternoon weekdays",
  },

  /* ------------------------------- Professional ------------------------------ */
  {
    key: "legal", label: "Law Firm", group: "Professional", osm: ["office=lawyer", "office=notary"],
    revenueUSD: [400_000, 2_000_000], digitalDependency: 0.75, spendPropensity: 0.75, transactional: "inquiry",
    customers: [
      { name: "Individuals with urgent matters", description: "Family, property and criminal; search and call immediately", share: 50 },
      { name: "Small businesses", description: "Contracts and compliance, value retainers", share: 35 },
      { name: "Referrals", description: "Word of mouth, still verify online", share: 15 },
    ],
    journey: "Searches the legal issue, checks practice areas and credibility signals, then calls or submits an inquiry.",
    services: ["redesign", "localSeo", "crm", "analytics", "website", "reviews"],
    decisionMaker: "Managing partner", timing: "Early morning before court or late afternoon",
  },
  {
    key: "accounting", label: "Accounting & Tax", group: "Professional", osm: ["office=accountant", "office=tax_advisor", "office=financial", "office=financial_advisor"],
    revenueUSD: [300_000, 1_500_000], digitalDependency: 0.65, spendPropensity: 0.7, transactional: "inquiry",
    customers: [
      { name: "Small business owners", description: "Bookkeeping and filings, recurring fees", share: 55 },
      { name: "Salaried individuals", description: "Seasonal tax filing", share: 30 },
      { name: "Startups", description: "Incorporation and compliance", share: 15 },
    ],
    journey: "Asks peers or searches, checks services and credentials, books a consultation.",
    services: ["portal", "redesign", "crm", "localSeo", "website"],
    decisionMaker: "Senior partner", timing: "Outside tax season, mid-week",
  },
  {
    key: "real_estate", label: "Real Estate", group: "Professional", osm: ["office=estate_agent", "shop=estate_agent"],
    revenueUSD: [300_000, 1_500_000], digitalDependency: 0.85, spendPropensity: 0.7, transactional: "inquiry",
    customers: [
      { name: "Home buyers", description: "Browse listings online for months", share: 40 },
      { name: "Tenants", description: "Fast-moving rental searches", share: 40 },
      { name: "Property owners", description: "Want to list and sell quickly", share: 20 },
    ],
    journey: "Browses listings on portals and Instagram, enquires on WhatsApp, visits shortlisted properties.",
    services: ["listings", "crm", "whatsapp", "redesign", "localSeo", "website"],
    decisionMaker: "Agency owner / broker", timing: "Weekday mornings",
  },
  {
    key: "agency", label: "Agency & Consulting", group: "Professional", osm: ["office=consulting", "office=advertising_agency", "office=insurance", "office=travel_agent", "shop=travel_agency", "office=employment_agency", "office=architect"],
    revenueUSD: [300_000, 1_500_000], digitalDependency: 0.75, spendPropensity: 0.7, transactional: "inquiry",
    customers: [
      { name: "SMB clients", description: "Need trust signals and case studies", share: 55 },
      { name: "Individuals", description: "Insurance, travel, careers", share: 35 },
      { name: "Corporate accounts", description: "Long sales cycles", share: 10 },
    ],
    journey: "Searches the service, reads case studies and reviews, fills an inquiry form or calls.",
    services: ["redesign", "crm", "analytics", "localSeo", "website"],
    decisionMaker: "Founder / managing director", timing: "Tuesday-Thursday mornings",
  },
  {
    key: "photography", label: "Photography & Events", group: "Professional", osm: ["shop=photo", "craft=photographer", "office=event_management", "shop=party"],
    revenueUSD: [100_000, 450_000], digitalDependency: 0.9, spendPropensity: 0.5, transactional: "inquiry",
    customers: [
      { name: "Couples & families", description: "Weddings and shoots, portfolio-driven", share: 60 },
      { name: "Brands & businesses", description: "Product and event coverage", share: 40 },
    ],
    journey: "Browses portfolios on Instagram and websites, compares packages, enquires by DM.",
    services: ["redesign", "booking", "social", "localSeo", "website"],
    decisionMaker: owner, timing: "Weekday mornings",
  },

  /* --------------------------------- Hospitality ----------------------------- */
  {
    key: "hotel", label: "Hotel / Guest House", group: "Hospitality", osm: ["tourism=hotel", "tourism=guest_house", "tourism=hostel", "tourism=motel", "tourism=apartment"],
    revenueUSD: [400_000, 3_000_000], digitalDependency: 0.9, spendPropensity: 0.7, transactional: "booking",
    customers: [
      { name: "Leisure travellers", description: "Book via OTAs, compare reviews and photos", share: 50 },
      { name: "Business travellers", description: "Location and reliability", share: 30 },
      { name: "Families & groups", description: "Weddings and events, bulk bookings", share: 20 },
    ],
    journey: "Compares on OTAs and maps, checks the hotel's own site for a better rate, books where it's cheapest and easiest.",
    services: ["booking", "redesign", "localSeo", "reviews", "analytics", "website"],
    decisionMaker: "Owner or general manager", timing: "Weekday afternoons",
  },

  /* --------------------------------- Education -------------------------------- */
  {
    key: "coaching", label: "Coaching & Training", group: "Education", osm: ["amenity=language_school", "amenity=music_school", "amenity=driving_school", "amenity=training", "amenity=prep_school", "amenity=tutoring"],
    revenueUSD: [150_000, 800_000], digitalDependency: 0.8, spendPropensity: 0.6, transactional: "inquiry",
    customers: [
      { name: "Students", description: "Exam prep and skills, research results and reviews", share: 55 },
      { name: "Parents", description: "Decision makers for younger students", share: 30 },
      { name: "Working professionals", description: "Weekend batches and online classes", share: 15 },
    ],
    journey: "Searches courses nearby, compares results, fees and batch timings, attends a demo class.",
    services: ["portal", "crm", "website", "localSeo", "social", "whatsapp"],
    decisionMaker: "Founder / centre director", timing: "Late morning before batches start",
  },

  /* ------------------------------------ Auto ---------------------------------- */
  {
    key: "auto", label: "Auto Service & Sales", group: "Auto", osm: ["shop=car_repair", "shop=car", "shop=tyres", "shop=car_parts", "amenity=car_wash", "shop=motorcycle"],
    revenueUSD: [400_000, 2_000_000], digitalDependency: 0.65, spendPropensity: 0.55, transactional: "booking",
    customers: [
      { name: "Car owners", description: "Servicing and repairs, value trust and transparent pricing", share: 60 },
      { name: "Buyers", description: "New/used vehicles, research online", share: 25 },
      { name: "Fleet operators", description: "Recurring maintenance contracts", share: 15 },
    ],
    journey: "Searches for a trustworthy garage, reads reviews about honesty, calls for a quote.",
    services: ["booking", "localSeo", "crm", "whatsapp", "reviews", "website"],
    decisionMaker: "Owner / workshop manager", timing: "Mid-week afternoons",
  },

  /* ------------------------------- Home Services ------------------------------ */
  {
    key: "trades", label: "Home Services & Trades", group: "Home Services", osm: ["craft=plumber", "craft=electrician", "craft=carpenter", "craft=painter", "craft=hvac", "craft=roofer", "craft=gardener", "shop=hardware", "shop=doityourself", "shop=dry_cleaning", "shop=laundry", "amenity=laundry"],
    revenueUSD: [150_000, 800_000], digitalDependency: 0.75, spendPropensity: 0.5, transactional: "booking",
    customers: [
      { name: "Homeowners with urgent issues", description: "Search and call immediately, choose by reviews", share: 55 },
      { name: "Renovators", description: "Planned projects, compare quotes", share: 30 },
      { name: "Property managers", description: "Recurring work", share: 15 },
    ],
    journey: "Searches the problem plus 'near me', calls the first credible result with good reviews.",
    services: ["localSeo", "website", "booking", "reviews", "whatsapp", "crm"],
    decisionMaker: owner, timing: "Early morning (before jobs) or evening",
  },
];

export const CATEGORY_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as Record<string, CategoryDef>;

/** Find the category for a set of OSM tags. */
export function matchCategory(tags: Record<string, string>): CategoryDef | null {
  for (const c of CATEGORIES) {
    for (const m of c.osm) {
      const [k, v] = m.split("=");
      if (tags[k] === v) return c;
    }
  }
  return null;
}

/* --------------------------- service catalogue --------------------------- */

export interface ServiceDef {
  key: ServiceKey;
  name: string;
  description: string;
  /** US-market freelance price range, USD. */
  priceUSD: [number, number];
  pricingModel: "one-time" | "monthly" | "retainer";
  effortDays: number;
  impact: string;
}

export const SERVICES: Record<ServiceKey, ServiceDef> = {
  website: {
    key: "website", name: "Professional website",
    description: "A fast, mobile-first site with services, prices, photos, location and a clear call-to-action.",
    priceUSD: [1200, 3500], pricingModel: "one-time", effortDays: 10,
    impact: "Captures customers who search before visiting; typically lifts enquiries 20-40% for businesses with no site.",
  },
  redesign: {
    key: "redesign", name: "Mobile-first redesign",
    description: "Rebuild the existing site for speed, mobile, trust signals and conversion.",
    priceUSD: [1500, 5000], pricingModel: "one-time", effortDays: 14,
    impact: "Most local traffic is mobile; a modern site converts 1.5-2x better than a dated desktop-era one.",
  },
  booking: {
    key: "booking", name: "Online booking system",
    description: "24/7 appointment/table booking with reminders, deposits and calendar sync.",
    priceUSD: [800, 3000], pricingModel: "one-time", effortDays: 8,
    impact: "Captures after-hours demand and cuts no-shows 25-40% with automated reminders.",
  },
  ordering: {
    key: "ordering", name: "Direct online ordering",
    description: "Commission-free ordering (pickup/delivery) with a digital menu and QR codes.",
    priceUSD: [1000, 3500], pricingModel: "one-time", effortDays: 10,
    impact: "Moves repeat customers off aggregator apps, saving 15-30% commission per order.",
  },
  ecommerce: {
    key: "ecommerce", name: "E-commerce store",
    description: "Online catalogue with checkout, inventory sync and WhatsApp/Instagram integration.",
    priceUSD: [2000, 6000], pricingModel: "one-time", effortDays: 18,
    impact: "Opens a sales channel beyond walk-ins and turns Instagram interest into purchases.",
  },
  localSeo: {
    key: "localSeo", name: "Local SEO & Google profile",
    description: "Optimise Google Business Profile, local keywords, schema markup and citations.",
    priceUSD: [300, 900], pricingModel: "monthly", effortDays: 4,
    impact: "Ranking in the top 3 map results captures most 'near me' clicks.",
  },
  performance: {
    key: "performance", name: "Speed & technical fixes",
    description: "Fix HTTPS, page speed, broken metadata and mobile issues on the current site.",
    priceUSD: [400, 1200], pricingModel: "one-time", effortDays: 4,
    impact: "Every extra second of load time loses a meaningful share of mobile visitors.",
  },
  analytics: {
    key: "analytics", name: "Analytics & conversion tracking",
    description: "Set up analytics, call/form tracking and a simple monthly dashboard.",
    priceUSD: [300, 900], pricingModel: "one-time", effortDays: 3,
    impact: "Shows which channels bring customers so marketing spend stops being guesswork.",
  },
  social: {
    key: "social", name: "Social presence kit",
    description: "Set up/refresh Instagram & Facebook, link-in-bio page, content templates and auto-posting.",
    priceUSD: [400, 1200], pricingModel: "one-time", effortDays: 5,
    impact: "Social is the primary discovery channel for this category; consistency drives follower growth.",
  },
  whatsapp: {
    key: "whatsapp", name: "WhatsApp Business automation",
    description: "Catalogue, quick replies, order/booking bot and broadcast lists.",
    priceUSD: [500, 1500], pricingModel: "one-time", effortDays: 6,
    impact: "Customers already message them; automation answers instantly and captures repeat orders.",
  },
  reviews: {
    key: "reviews", name: "Review generation engine",
    description: "Automated post-visit review requests via SMS/WhatsApp/QR, with a reply dashboard.",
    priceUSD: [300, 900], pricingModel: "one-time", effortDays: 3,
    impact: "More recent reviews raise map ranking and click-through.",
  },
  crm: {
    key: "crm", name: "Customer CRM & loyalty",
    description: "Customer database, loyalty points, birthday offers and win-back messages.",
    priceUSD: [1000, 3000], pricingModel: "one-time", effortDays: 10,
    impact: "Repeat customers are cheaper to win than new ones; loyalty programs lift visit frequency.",
  },
  listings: {
    key: "listings", name: "Property listings platform",
    description: "Searchable listing site with filters, enquiry capture and WhatsApp lead routing.",
    priceUSD: [2000, 6000], pricingModel: "one-time", effortDays: 18,
    impact: "Owns leads instead of paying portals for each one.",
  },
  portal: {
    key: "portal", name: "Client / member portal",
    description: "Login area for records, schedules, payments and documents.",
    priceUSD: [2500, 8000], pricingModel: "one-time", effortDays: 22,
    impact: "Cuts admin calls and makes the business feel premium.",
  },
};
