export const ADDING_PEOPLE_SECTIONS = ["start", "segments", "how_to", "visibility", "trouble", "faq"] as const;

export type AddingPeopleSectionId = (typeof ADDING_PEOPLE_SECTIONS)[number];

export type AddingPeopleSection = {
  id: AddingPeopleSectionId;
  title: string;
  body: string[];
  table?: { head: string[]; rows: string[][] };
  bullets?: string[];
};

export type AddingPeopleContent = {
  title: string;
  intro: string;
  sections: AddingPeopleSection[];
};

export const ADDING_PEOPLE: AddingPeopleContent = {
  title: "Adding people to Lasso",
  intro: "You ask for seats. We approve them and give you a key. Then you either give us the list of people and we email each of them, or you take a link and hand it out yourself. Either way you can see who has joined. Nobody at your organisation sees anyone's work unless that person chooses to share it with you.",
  sections: [
    {
      id: "start",
      title: "Three words you will see",
      body: [
        "Seat. One person's place in Lasso for the length of your engagement. You are given a number of seats and you cannot go over it. Nothing is charged while we pilot.",
        "Key. A short code like LSO-WPSK77. Giving someone the key, or a link containing it, is how they claim a seat. One person can only use it once.",
        "Register. Which version of Lasso someone gets: just me, school, or team. It changes the words in the product and whether the workspace has members. You pick it when you request seats, and the link carries it, so the person never has to choose.",
      ],
    },
    {
      id: "segments",
      title: "What you can ask for",
      table: {
        head: ["What you are running", "Ask for", "Each person gets", "Who adds the people"],
        rows: [
          ["Individuals you sponsor, a workshop, a fellowship, coaching clients", "Individual seats", "Their own private workspace", "You, by naming them or handing out a link"],
          ["A class or a student cohort", "School seats", "Their own student workspace, which they keep after the term", "You, the same two ways"],
          ["One client company or one team", "A team workspace", "Shared membership of one workspace", "The client's own admin, after you name that admin"],
          ["Your own practice", "A partner workspace", "Your staff share one workspace", "We set it up once, then you"],
        ],
      },
      body: [
        "Individual and school seats both end with the person owning their own workspace. That is deliberate. When your engagement ends they keep their record and you have nothing to unwind.",
        "A team workspace is for people who all work at the same place and are meant to see each other's work. You name one person as the admin, we email that person a link that only works for their address, and they add their own colleagues by email. Any email domain is allowed by default, so they can add a contractor or a partner from another company. If you would rather lock it to their work domain, say so when you request the seats.",
        "If you want one shared class workspace with a teacher in charge rather than one workspace per student, ask for a team workspace and put the teacher down as the admin.",
      ],
    },
    {
      id: "how_to",
      title: "How to add people",
      body: [
        "Request seats on the Workshop keys screen. Client or cohort name, which of the four above, how many seats, start and end dates. Addresses are optional. For a team workspace the admin's email is required, because their link is locked to it.",
        "Wait for approval. Usually the same day. The row turns to Ready.",
        "Then either add people and send invitations, so Lasso emails one invitation per address naming you as the sponsor, or copy the attendee link and send it yourself. Use the link when you do not have the addresses yet, which is most of the time at the start.",
        "Watch the list. Each named person shows as invited, then joined. The seats remaining count goes down as people join.",
        "You can remove someone who has not joined yet, which frees their seat for another name. You cannot remove someone who has already joined, because that is their workspace now, not yours. Ask us and we will end the engagement properly.",
      ],
    },
    {
      id: "visibility",
      title: "What you can and cannot see",
      body: ["The person owns their record. A sponsored seat buys someone a place in Lasso, it does not buy a view of them."],
      table: {
        head: ["You can see", "You cannot see"],
        rows: [
          ["Who you invited, and whether they have joined", "Anyone's work, boards, documents or AI conversations, unless they share them"],
          ["How many of your seats are used", "Whether someone opened your invitation email, or clicked it"],
          ["When the engagement starts and ends", "How often anyone uses Lasso, how long for, or what they looked at"],
          ["Anything a person chooses to share with you", "Any score, ranking or rating of a person. Lasso does not produce them"],
        ],
      },
      bullets: [
        "Right after someone sets up their sponsored workspace we ask them once whether they would like to share work with you.",
        "If they say yes, you appear as a destination when they share something, and you see only what they send.",
        "If they say no, we do not ask again, and they can change their mind in Settings.",
      ],
    },
    {
      id: "trouble",
      title: "When something goes wrong",
      body: [],
      table: {
        head: ["What you see", "What it means", "What to do"],
        rows: [
          ["This invitation was sent to a different address", "They are signed in as someone else, or signing up with an address you did not name", "They can sign out and use the invited address, or you add the address they actually want to use"],
          ["We do not recognise that code", "A typo, or the code was for a workspace invite rather than a key", "Paste the whole link rather than retyping the code"],
          ["That key has expired", "The engagement end date has passed", "Ask us for an extension. A new key extends the same workspace, it does not make a second one"],
          ["All seats are taken", "The seat count is used up", "Ask us for more seats, or remove someone who has not joined"],
          ["The invitation did not arrive", "Usually spam, occasionally a wrong address", "They can ask for a resend on the confirmation screen, or you can send the attendee link directly"],
          ["Someone already has a Lasso account", "Common and fine", "They sign in, and the key attaches to the workspace they already have"],
        ],
      },
    },
    {
      id: "faq",
      title: "The questions partners actually ask",
      body: [
        "Do I have to collect everyone's email first? No. Hand out the link and name people later, or never.",
        "Can two of my cohorts share one key? No. One request, one key, one seat count, one end date, so your reporting stays separate.",
        "Can someone be sponsored by two of us? Yes. A second sponsor is recorded alongside the first and each of you sees only what that person shares with you.",
        "What happens at the end? Nothing is locked and nothing is deleted. The person keeps their workspace and their record. If they want to carry on, they pay for it themselves.",
      ],
    },
  ],
};
