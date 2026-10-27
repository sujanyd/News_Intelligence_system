/**
 * MOCK DATA (sample data for building the screens)
 *
 * The backend does not have article or source endpoints yet, so the
 * Articles and Sources pages use this sample data instead.
 *
 * All names and links below are made up. Every website uses the ".example"
 * ending, which is reserved for examples and never points to a real site.
 *
 * The shape of each object matches docs in frontend/API_CONTRACT.md.
 * When the real API is ready, set VITE_USE_MOCK_DATA=false in .env and
 * this file is no longer used.
 */

export const MOCK_SOURCES = [
  {
    id: 1,
    name: 'Daily Ledger',
    base_url: 'https://dailyledger.example',
    created_at: '2026-10-01T09:00:00Z',
  },
  {
    id: 2,
    name: 'Global Wire',
    base_url: 'https://globalwire.example',
    created_at: '2026-10-02T10:30:00Z',
  },
  {
    id: 3,
    name: 'Metro Times',
    base_url: 'https://metrotimes.example',
    created_at: '2026-10-03T08:15:00Z',
  },
  {
    id: 4,
    name: 'The Civic Post',
    base_url: 'https://civicpost.example',
    created_at: '2026-10-05T12:00:00Z',
  },
  {
    id: 5,
    name: 'Coastal Herald',
    base_url: 'https://coastalherald.example',
    created_at: '2026-10-06T07:45:00Z',
  },
]

export const MOCK_ARTICLES = [
  {
    id: 101,
    source_id: 1,
    source_name: 'Daily Ledger',
    title: 'City council approves new budget for public transport',
    url: 'https://dailyledger.example/news/transport-budget',
    published_at: '2026-10-26T08:30:00Z',
    retrieved_at: '2026-10-26T09:00:00Z',
    content:
      'The city council voted on Monday to approve a larger budget for buses and trains. Supporters said the plan will reduce traffic, while some members asked how it will be paid for.',
  },
  {
    id: 102,
    source_id: 2,
    source_name: 'Global Wire',
    title: 'Transport budget passes after long council debate',
    url: 'https://globalwire.example/stories/council-transport-vote',
    published_at: '2026-10-26T09:10:00Z',
    retrieved_at: '2026-10-26T09:30:00Z',
    content:
      'After a debate that lasted more than four hours, the council passed the transport budget. Several members raised concerns about higher local taxes.',
  },
  {
    id: 103,
    source_id: 3,
    source_name: 'Metro Times',
    title: 'Commuters react to planned bus route changes',
    url: 'https://metrotimes.example/local/bus-route-changes',
    published_at: '2026-10-25T17:45:00Z',
    retrieved_at: '2026-10-25T18:05:00Z',
    content: null,
  },
  {
    id: 104,
    source_id: 4,
    source_name: 'The Civic Post',
    title: 'Heavy rain expected across the region this weekend',
    url: 'https://civicpost.example/weather/weekend-rain',
    published_at: '2026-10-25T06:00:00Z',
    retrieved_at: '2026-10-25T06:20:00Z',
    content:
      'Weather officials expect heavy rain from Friday night until Sunday. Residents in low-lying areas are advised to stay alert for flood warnings.',
  },
  {
    id: 105,
    source_id: 5,
    source_name: 'Coastal Herald',
    title: 'Fishing communities prepare for weekend storm',
    url: 'https://coastalherald.example/coast/storm-preparations',
    published_at: '2026-10-25T07:20:00Z',
    retrieved_at: '2026-10-25T07:40:00Z',
    content:
      'Boat owners along the coast are moving their boats to safer harbours ahead of the storm. Local leaders have opened two community shelters.',
  },
  {
    id: 106,
    source_id: 1,
    source_name: 'Daily Ledger',
    title: 'University announces new scholarship for first-generation students',
    url: 'https://dailyledger.example/education/new-scholarship',
    published_at: '2026-10-24T11:00:00Z',
    retrieved_at: '2026-10-24T11:15:00Z',
    content:
      'The state university will offer 200 new scholarships next year for students who are the first in their family to attend college.',
  },
  {
    id: 107,
    source_id: 2,
    source_name: 'Global Wire',
    title: 'Electric car sales rise for the third month in a row',
    url: 'https://globalwire.example/business/electric-car-sales',
    published_at: '2026-10-24T13:40:00Z',
    retrieved_at: '2026-10-24T14:00:00Z',
    content:
      'Sales of electric cars went up again last month. Industry groups say lower battery prices are one reason, but charging stations are still limited.',
  },
  {
    id: 108,
    source_id: 3,
    source_name: 'Metro Times',
    title: 'Local library extends weekend opening hours',
    url: 'https://metrotimes.example/community/library-hours',
    published_at: null,
    retrieved_at: '2026-10-23T16:10:00Z',
    content:
      'The central library will now stay open until 8 PM on Saturdays and Sundays, following requests from students preparing for exams.',
  },
  {
    id: 109,
    source_id: 4,
    source_name: 'The Civic Post',
    title: 'Hospital opens new emergency wing',
    url: 'https://civicpost.example/health/emergency-wing',
    published_at: '2026-10-23T09:30:00Z',
    retrieved_at: '2026-10-23T09:50:00Z',
    content: '',
  },
  {
    id: 110,
    source_id: 5,
    source_name: 'Coastal Herald',
    title: 'Beach clean-up drive collects two tonnes of plastic',
    url: 'https://coastalherald.example/environment/beach-cleanup',
    published_at: '2026-10-22T15:00:00Z',
    retrieved_at: '2026-10-22T15:30:00Z',
    content:
      'More than 300 volunteers joined the weekend beach clean-up. Organisers said most of the waste was plastic bottles and food wrappers.',
  },
  {
    id: 111,
    source_id: 1,
    source_name: 'Daily Ledger',
    title: 'Food prices remain steady despite fuel cost increase',
    url: 'https://dailyledger.example/economy/food-prices',
    published_at: '2026-10-21T10:20:00Z',
    retrieved_at: '2026-10-21T10:45:00Z',
    content:
      'Prices of everyday food items did not change much this month, even though fuel became more expensive. Shop owners warn that this may not last.',
  },
  {
    id: 112,
    source_id: 2,
    source_name: 'Global Wire',
    title: 'Fuel costs push up delivery charges, retailers say',
    url: 'https://globalwire.example/business/delivery-charges',
    published_at: '2026-10-21T12:05:00Z',
    retrieved_at: '2026-10-21T12:30:00Z',
    content: null,
  },
]
