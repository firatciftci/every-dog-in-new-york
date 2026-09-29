/**
 * Every `try` string is a button that puts that text in the search box, so each one must parse.
 */
export const HELP = {
  title: "Search the map",
  dek: "Type a breed, a name, or a place. The box says what it understood before anything changes.",
  sections: [
    {
      heading: "Find dogs and places",
      line: "Matches appear grouped by kind.",
      rows: [
        { try: "Bella", does: "shows dogs with that name" },
        { try: "breed:", does: "filters the list to show only breeds" },
        { try: "Greenpoint", does: "opens the neighborhood profile" },
      ],
    },
    {
      heading: "Compare dogs or places",
      line: "Up to four at a time.",
      rows: [
        {
          try: "Labrador vs Poodle",
          does: "colors each neighborhood by whichever breed is more common there",
        },
        {
          try: "Brooklyn vs Queens",
          does: "compares the boroughs side by side",
        },
      ],
    },
    {
      heading: "Take places off the map",
      line: "",
      rows: [
        { try: "in the Bronx", does: "keeps only the Bronx" },
        {
          try: "except Brooklyn and Queens",
          does: "removes both boroughs from the map",
        },
      ],
    },
    {
      heading: "Set limits",
      line: "Measure dogs, people, homes, or density.",
      rows: [
        { try: "under 3 per home", does: "finds places with low ownership" },
        {
          try: "more than 50,000 people",
          does: "finds heavily populated neighborhoods",
        },
        {
          try: "over 500 and under 2,000 dogs",
          does: "finds neighborhoods within that dog population range",
        },
      ],
    },
    {
      heading: "Stack rules",
      line: "Combine rules, or press Show me something strange for a random finding.",
      rows: [
        {
          try: "Poodle in Brooklyn",
          does: "maps the breed across one borough",
        },
        {
          try: "Maltese vs Poodle in Brooklyn and Queens over 500 dogs",
          does: "compares breeds in two boroughs with high dog populations",
        },
      ],
    },
  ],
  keys: "Cmd-K or Ctrl-K opens the box, Up and Down walk the list, Enter takes the match, and Escape closes.",
} as const;
